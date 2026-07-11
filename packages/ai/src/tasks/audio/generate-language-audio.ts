import "server-only";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { type TTSVoice } from "@zoonk/utils/languages";
import { logError } from "@zoonk/utils/logger";
import { generateSpeech } from "ai";
import { getPromptLanguageName } from "../_utils/prompt-language";
import alphabetSymbolPrompt from "./generate-language-audio-alphabet-symbol.prompt.md";
import promptTemplate from "./generate-language-audio.prompt.md";
import { type SpeechModelName, speechModels } from "./speech-models";
import { type AudioFormat, getSpeechProvider } from "./speech-provider";

const DEFAULT_VOICE: TTSVoice = "Kore";
const defaultModel = speechModels.google;
const fallbackModels = [speechModels.openai] as const;

/* oxlint-disable-next-line no-magic-numbers -- 850 KiB is the prompt-leak failure threshold observed in generated audio files. */
const MAX_AUDIO_BYTES = 850 * 1024;

const READ_ALOUD_TEMPLATE =
  "The following text is {{LANGUAGE}}. Speak clearly at a moderate pace suitable for language learners. Enunciate each word precisely; read it aloud in {{LANGUAGE}}.";

export type AudioResult = { audio: Uint8Array; format: AudioFormat };
export type LanguageAudioUsage = "alphabetSymbol";

const usagePrompts = { alphabetSymbol: alphabetSymbolPrompt } satisfies Record<
  LanguageAudioUsage,
  string
>;

/**
 * Skips prompt guidance for normal English word and sentence audio because the
 * extra instructions exist to prevent non-English words from being read with
 * English pronunciation. Usage-specific audio, such as alphabet symbols, still
 * gets guidance because the text may not be a normal word.
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
 * Uses only the requested model when a task chooses one explicitly. Tasks that
 * omit a model retain the shared Gemini-first, OpenAI-fallback behavior.
 */
function getSpeechModels(model?: SpeechModelName): readonly SpeechModelName[] {
  return model ? [model] : [defaultModel, ...fallbackModels];
}

/**
 * Rejects suspiciously large audio from every provider before upload. Keeping
 * one task-level limit prevents a provider-specific implementation from
 * bypassing the prompt-leak safeguard when tasks choose different models.
 */
function assertExpectedAudioSize({ audio, model }: { audio: Uint8Array; model: SpeechModelName }) {
  if (audio.byteLength <= MAX_AUDIO_BYTES) {
    return;
  }

  throw new Error(
    `${model} returned oversized audio: ${audio.byteLength} bytes. Expected at most ${MAX_AUDIO_BYTES} bytes.`,
  );
}

/**
 * Generates one speech result through the AI SDK after the provider resolver
 * has selected the correct SDK model, output format, and compatible voice.
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
  const provider = getSpeechProvider({ model, voice });

  const { audio } = await generateSpeech({
    ...(instructions ? { instructions } : {}),
    model: provider.model,
    outputFormat: provider.format,
    text,
    voice: provider.voice,
  });

  assertExpectedAudioSize({ audio: audio.uint8Array, model });

  return { audio: audio.uint8Array, format: provider.format };
}

/**
 * Tries provider-qualified models in order. AI SDK handles retries for each
 * model; this layer only owns cross-provider fallback when no model was chosen
 * explicitly by the calling task.
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
