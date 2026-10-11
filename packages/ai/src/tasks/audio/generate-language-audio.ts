import "server-only";
import { randomUUID } from "node:crypto";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import {
  type TTSVoice,
  getBaseLanguage,
  isOpenAITTSSupportedLanguage,
} from "@zoonk/utils/languages";
import { logError } from "@zoonk/utils/logger";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { captureAiGeneration } from "../../provenance/ai-generation-sink";
import { type TaskProvenance } from "../../provenance/task-provenance";
import { convertWavToMp3 } from "./convert-wav-to-mp3";
import alphabetSymbolPrompt from "./generate-language-audio-alphabet-symbol.prompt.md";
import { DEFAULT_LANGUAGE_AUDIO_VOICE, getLanguageAudioPrompt } from "./language-audio-prompt";
import { assertExpectedAudioSize, getMaxSeconds } from "./speech-limits";
import { type SpeechModelName, speechModels } from "./speech-models";
import { buildSpeechProvenance } from "./speech-provenance";
import { generateSpeechWithProvider } from "./speech-provider";

const TASK = "language-audio";
const MS_PER_SECOND = 1000;

/**
 * The text-to-speech run that voiced a clip, stored with the audio like every generated row's
 * provenance. `promptVersion` covers the voice and the instructions it was read with.
 */
export type SpeechProvenance = Pick<
  TaskProvenance,
  "generatedAt" | "model" | "promptVersion" | "runId"
>;

type VoicedAudio = {
  audio: Uint8Array;
  durationSeconds: number;
  format: "mp3";
  model: SpeechModelName;
  providerMetadata: Record<string, unknown>;
};

export type AudioResult = {
  audio: Uint8Array;
  /** How long the clip plays. */
  durationMs: number;
  format: "mp3";
  provenance: TaskProvenance;
};

export type LanguageAudioUsage = "alphabetSymbol";

const usagePrompts = { alphabetSymbol: alphabetSymbolPrompt } satisfies Record<
  LanguageAudioUsage,
  string
>;

/**
 * The automatic order: Gemini Flash, then Gemini Flash Lite, then OpenAI for the languages it
 * supports (see `speechModels`). Each model is tried once: the next one is the retry. An explicit
 * model, from the audio test tool, gets a second attempt instead, because transport retries can't
 * see silent or malformed audio.
 */
function getSpeechModels({
  language,
  model,
}: {
  language: string;
  model?: SpeechModelName;
}): readonly SpeechModelName[] {
  if (model) {
    return [model, model];
  }

  return [
    speechModels.geminiFlash,
    speechModels.geminiFlashLite,
    ...(isOpenAITTSSupportedLanguage(getBaseLanguage(language)) ? [speechModels.openai] : []),
  ];
}

/**
 * Generates WAV and converts it to the one upload format inside the retry boundary. Malformed,
 * silent or overlong audio therefore follows the same fallback path as transport and API
 * failures, whichever provider produced it.
 */
async function generateWithModel({
  instructions,
  model,
  text,
  voice,
}: {
  instructions: string;
  model: SpeechModelName;
  text: string;
  voice: TTSVoice;
}): Promise<VoicedAudio> {
  const maxSeconds = getMaxSeconds(text);

  const { audio: wavAudio, providerMetadata } = await generateSpeechWithProvider({
    instructions,
    model,
    text,
    voice,
  });

  assertExpectedAudioSize({ audio: wavAudio, maxSeconds, model });

  const { audio, durationSeconds } = await convertWavToMp3({ audio: wavAudio, maxSeconds, model });
  return { audio, durationSeconds, format: "mp3", model, providerMetadata };
}

/**
 * Tries provider-qualified models in order. Each adapter owns transient request retries; this
 * layer owns cross-model and post-decode quality retries.
 */
async function generateWithFallback({
  models,
  ...input
}: {
  instructions: string;
  models: readonly SpeechModelName[];
  text: string;
  voice: TTSVoice;
}): Promise<VoicedAudio> {
  const [model, ...remainingModels] = models;

  if (!model) {
    throw new Error("No speech model configured");
  }

  try {
    return await generateWithModel({ ...input, model });
  } catch (error) {
    if (remainingModels.length > 0) {
      return generateWithFallback({ ...input, models: remainingModels });
    }

    const lastError = error instanceof Error ? error : new Error(String(error));
    logError("All TTS providers failed after retries:", lastError);
    throw lastError;
  }
}

/**
 * Voices a word, sentence or passage in its language, Gemini first (see `speechModels`). Every
 * request names the language in its instructions, English included. An explicit model bypasses
 * the automatic order. The result names the model that actually voiced it, after any fallback,
 * and how long the clip plays.
 */
export async function generateLanguageAudio({
  analytics,
  language,
  model,
  text,
  usage,
  voice = DEFAULT_LANGUAGE_AUDIO_VOICE,
}: {
  analytics?: AiGenerationContext;
  language: string;
  model?: SpeechModelName;
  text: string;
  usage?: LanguageAudioUsage;
  voice?: TTSVoice;
}): Promise<SafeReturn<AudioResult>> {
  const { instructions, promptVersion } = getLanguageAudioPrompt({
    language,
    usagePrompt: usage ? usagePrompts[usage] : "",
    voice,
  });

  const models = getSpeechModels({ language, ...(model ? { model } : {}) });
  const [requestedModel = speechModels.geminiFlash] = models;
  const runId = randomUUID();
  const startedAt = performance.now();

  return safeAsync(async () => {
    const voiced = await generateWithFallback({ instructions, models, text, voice });

    const provenance = buildSpeechProvenance({
      latencyMs: Math.round(performance.now() - startedAt),
      promptVersion,
      read: `${instructions}\n${text}`,
      requestedModel,
      runId,
      voiced,
    });

    await captureAiGeneration({ context: analytics, provenance, task: TASK });

    return {
      audio: voiced.audio,
      durationMs: Math.round(voiced.durationSeconds * MS_PER_SECOND),
      format: voiced.format,
      provenance,
    };
  });
}
