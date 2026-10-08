import "server-only";
import { randomUUID } from "node:crypto";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import {
  type TTSVoice,
  getBaseLanguage,
  isOpenAITTSSupportedLanguage,
} from "@zoonk/utils/languages";
import { logError } from "@zoonk/utils/logger";
import { getModelFamily } from "../../_utils/model-family";
import { computeCallCostUsd } from "../../pricing/call-cost";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { captureAiGeneration } from "../../provenance/ai-generation-sink";
import { readGatewayMetadata } from "../../provenance/gateway-metadata";
import { type TaskProvenance } from "../../provenance/task-provenance";
import { convertWavToMp3 } from "./convert-wav-to-mp3";
import alphabetSymbolPrompt from "./generate-language-audio-alphabet-symbol.prompt.md";
import { DEFAULT_LANGUAGE_AUDIO_VOICE, getLanguageAudioPrompt } from "./language-audio-prompt";
import { type SpeechModelName, speechModels } from "./speech-models";
import { generateSpeechWithProvider } from "./speech-provider";

const TASK = "language-audio";
const MS_PER_SECOND = 1000;

/** Both providers return 24 kHz, 16-bit mono WAV. */
const WAV_BYTES_PER_SECOND = 48_000;
const WAV_HEADER_ALLOWANCE_BYTES = 1024;

/** Even a one-letter clip may take this long, with the pauses a voice leaves around it. */
const MIN_MAX_SECONDS = 18;

/** Slower than any voice reads aloud, so audio longer than this means the model read something else. */
const MIN_CHARACTERS_PER_SECOND = 8;

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
 * How long the clip may play. A model that reads its instructions aloud, or keeps talking,
 * returns far more audio than the text needs, so longer audio falls through to the next model.
 */
function getMaxSeconds(text: string): number {
  return Math.max(MIN_MAX_SECONDS, Math.ceil(text.length / MIN_CHARACTERS_PER_SECOND));
}

/**
 * Rejects suspiciously large audio from every provider before decoding it. Keeping one
 * task-level limit prevents a provider-specific implementation from bypassing the prompt-leak
 * safeguard.
 */
function assertExpectedAudioSize({
  audio,
  maxSeconds,
  model,
}: {
  audio: Uint8Array;
  maxSeconds: number;
  model: SpeechModelName;
}) {
  const maxBytes = maxSeconds * WAV_BYTES_PER_SECOND + WAV_HEADER_ALLOWANCE_BYTES;

  if (audio.byteLength <= maxBytes) {
    return;
  }

  throw new Error(
    `${model} returned oversized audio: ${audio.byteLength} bytes. Expected at most ${maxBytes} bytes.`,
  );
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
 * The text a speech model reads (its instructions and the clip's words), in tokens: the SDK
 * doesn't report them, and at about four characters a token they're a small part of the price.
 */
const CHARACTERS_PER_TEXT_TOKEN = 4;

/**
 * Speech is billed by the second of audio it returns and the text it reads, so the clip's length
 * and its words price it. AI Gateway's routing names the provider that served a Gemini clip and its
 * own estimate is kept as a cross-check.
 */
function buildSpeechProvenance({
  latencyMs,
  promptVersion,
  read,
  requestedModel,
  runId,
  voiced,
}: {
  latencyMs: number;
  promptVersion: string;
  /** Everything the model read: its instructions and the clip's words. */
  read: string;
  requestedModel: SpeechModelName;
  runId: string;
  voiced: VoicedAudio;
}): TaskProvenance {
  const gateway = readGatewayMetadata(voiced.providerMetadata);

  const usage = {
    audioSeconds: voiced.durationSeconds,
    inputTokens: Math.ceil(read.length / CHARACTERS_PER_TEXT_TOKEN),
  };

  return {
    costUsd: computeCallCostUsd({ model: voiced.model, usage }),
    credential: gateway.credential,
    gatewayCostUsd: gateway.costUsd,
    generatedAt: new Date().toISOString(),
    latencyMs,
    model: voiced.model,
    promptVersion,
    provider: gateway.servedProvider ?? getModelFamily(voiced.model),
    requestedModel,
    runId,
    usage,
  };
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
