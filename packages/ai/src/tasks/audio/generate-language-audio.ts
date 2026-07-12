import "server-only";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { type TTSVoice } from "@zoonk/utils/languages";
import { logError } from "@zoonk/utils/logger";
import { getPromptLanguageName } from "../_utils/prompt-language";
import { convertWavToMp3 } from "./convert-wav-to-mp3";
import alphabetSymbolPrompt from "./generate-language-audio-alphabet-symbol.prompt.md";
import promptTemplate from "./generate-language-audio.prompt.md";
import { type SpeechModelName, speechModels } from "./speech-models";
import { generateSpeechWithProvider } from "./speech-provider";

const DEFAULT_VOICE: TTSVoice = "Kore";
const defaultModel = speechModels.google;
const fallbackModels = [speechModels.openai] as const;
const MAX_ATTEMPTS_PER_PROVIDER = 2;

/* oxlint-disable-next-line no-magic-numbers -- 850 KiB fits an 18-second 24 kHz mono WAV. */
const MAX_PROVIDER_AUDIO_BYTES = 850 * 1024;

const READ_ALOUD_TEMPLATE =
  "The following text is {{LANGUAGE}}. Speak clearly at a moderate pace suitable for language learners. Enunciate each word precisely; read it aloud in {{LANGUAGE}}.";

export type AudioResult = { audio: Uint8Array; format: "mp3" };
export type LanguageAudioUsage = "alphabetSymbol";

const usagePrompts = { alphabetSymbol: alphabetSymbolPrompt } satisfies Record<
  LanguageAudioUsage,
  string
>;

/**
 * Skips task-level guidance for normal English word and sentence audio because
 * the extra instructions exist to prevent non-English words from being read
 * with English pronunciation. Usage-specific audio still gets its task prompt,
 * and the provider supplies the minimal guidance Gemini needs to stay in speech
 * mode.
 */
function shouldBuildInstructions({
  languageCode,
  usage,
}: {
  languageCode?: string;
  usage?: LanguageAudioUsage;
}) {
  return Boolean(usage) || Boolean(languageCode && languageCode !== "en");
}

/**
 * Expands the TTS prompt with optional usage-specific instructions. Keeping the
 * usage structured avoids passing learner-facing romanization or pronunciation
 * hints into the audio model, which can make output less stable.
 */
function buildInstructions({
  languageCode,
  usage,
}: {
  languageCode?: string;
  usage?: LanguageAudioUsage;
}): string | undefined {
  if (!shouldBuildInstructions({ languageCode, usage })) {
    return undefined;
  }

  const languageName = languageCode
    ? getPromptLanguageName({ language: languageCode })
    : getPromptLanguageName({ language: "en" });

  const languagePrompt =
    languageCode && languageCode !== "en"
      ? promptTemplate.replaceAll("{{LANGUAGE}}", () => languageName)
      : "";

  const usagePrompt = usage ? usagePrompts[usage] : "";
  const readAloudPrompt = READ_ALOUD_TEMPLATE.replaceAll("{{LANGUAGE}}", () => languageName);

  return [languagePrompt, usagePrompt, readAloudPrompt].filter(Boolean).join("\n\n");
}

/**
 * Tries each selected provider twice because transport retries cannot observe
 * semantic failures discovered only after decoded-signal validation. Tasks
 * without an explicit model alternate Gemini and OpenAI so either provider can
 * recover from the other's malformed, silent, or unavailable output.
 */
function getSpeechModels(model?: SpeechModelName): readonly SpeechModelName[] {
  const providerOrder = model ? [model] : [defaultModel, ...fallbackModels];
  return Array.from({ length: MAX_ATTEMPTS_PER_PROVIDER }, () => providerOrder).flat();
}

/**
 * Rejects suspiciously large audio from every provider before upload. Keeping
 * one task-level limit prevents a provider-specific implementation from
 * bypassing the prompt-leak safeguard when tasks choose different models.
 */
function assertExpectedAudioSize({ audio, model }: { audio: Uint8Array; model: SpeechModelName }) {
  if (audio.byteLength <= MAX_PROVIDER_AUDIO_BYTES) {
    return;
  }

  throw new Error(
    `${model} returned oversized audio: ${audio.byteLength} bytes. Expected at most ${MAX_PROVIDER_AUDIO_BYTES} bytes.`,
  );
}

/**
 * Generates WAV and converts it to the one upload format inside the retry
 * boundary. Malformed or silent audio therefore follows the same provider
 * fallback path as transport and API failures, regardless of which provider
 * produced it.
 */
async function generateWithModel({
  instructions,
  model,
  text,
  voice,
}: {
  instructions?: string;
  model: SpeechModelName;
  text: string;
  voice: TTSVoice;
}): Promise<AudioResult> {
  const wavAudio = await generateSpeechWithProvider({
    ...(instructions ? { instructions } : {}),
    model,
    text,
    voice,
  });

  assertExpectedAudioSize({ audio: wavAudio, model });

  const mp3Audio = await convertWavToMp3({ audio: wavAudio, model });
  return { audio: mp3Audio, format: "mp3" };
}

/**
 * Tries provider-qualified models in order. Each adapter owns transient request
 * retries; this layer owns cross-provider and post-decode quality retries.
 */
async function generateWithFallback({
  instructions,
  models,
  text,
  voice,
}: {
  instructions?: string;
  models: readonly SpeechModelName[];
  text: string;
  voice: TTSVoice;
}): Promise<AudioResult> {
  const [model, ...remainingModels] = models;

  if (!model) {
    throw new Error("No speech model configured");
  }

  try {
    return await generateWithModel({
      ...(instructions ? { instructions } : {}),
      model,
      text,
      voice,
    });
  } catch (error) {
    if (remainingModels.length > 0) {
      return generateWithFallback({
        ...(instructions ? { instructions } : {}),
        models: remainingModels,
        text,
        voice,
      });
    }

    const lastError = error instanceof Error ? error : new Error(String(error));
    logError("All TTS providers failed after retries:", lastError);
    throw lastError;
  }
}

/**
 * Generates audio for the given text using Gemini TTS as the primary
 * provider and OpenAI TTS as a fallback unless the task requests one model.
 */
export async function generateLanguageAudio({
  language,
  model,
  text,
  usage,
  voice = DEFAULT_VOICE,
}: {
  language?: string;
  model?: SpeechModelName;
  text: string;
  usage?: LanguageAudioUsage;
  voice?: TTSVoice;
}): Promise<SafeReturn<AudioResult>> {
  const instructions = buildInstructions({ languageCode: language, usage });

  return safeAsync(() =>
    generateWithFallback({
      ...(instructions ? { instructions } : {}),
      models: getSpeechModels(model),
      text,
      voice,
    }),
  );
}
