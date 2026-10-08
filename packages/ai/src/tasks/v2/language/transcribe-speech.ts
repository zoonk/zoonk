import "server-only";
import { randomUUID } from "node:crypto";
import { type OpenAITranscriptionModelOptions } from "@ai-sdk/openai";
import { getPromptVersion } from "@zoonk/utils/prompt-version";
import { transcribe } from "ai";
import { directOpenAI } from "../../../direct-providers";
import { zoonkGateway } from "../../../gateway";
import { computeCallCostUsd } from "../../../pricing/call-cost";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { captureAiGeneration } from "../../../provenance/ai-generation-sink";
import { type TaskProvenance } from "../../../provenance/task-provenance";

/**
 * Transcription models compared for spoken answers. gpt-transcribe goes to
 * OpenAI directly because AI Gateway doesn't list it; the rest go through the
 * gateway.
 */
export const TRANSCRIPTION_MODELS = [
  "openai/gpt-transcribe",
  "openai/gpt-4o-transcribe",
  "openai/gpt-4o-mini-transcribe",
  "google/gemini-3.5-transcribe",
] as const;

export type TranscriptionModelId = (typeof TRANSCRIPTION_MODELS)[number];

/**
 * Spoken answers use gpt-transcribe, OpenAI's latest transcription model, at
 * $0.0045 a minute against $0.006 for gpt-4o-transcribe, which is likely to be
 * retired first. Speech checks flag what a listener wouldn't understand, not an
 * accent, and it hears slips the way a listener would: "I sink it's cheap"
 * became "I think it's cheap" and "mas café" became "mais café". In the speech
 * eval (13 labeled text-to-speech clips in English, Portuguese and Spanish, 7
 * with a mistake by that rule; 28 Sep 2026) it matched 12 at 1.0s p50, as did
 * gpt-4o-transcribe at 1.1s, which kept "mas" and so flagged a sentence a
 * listener understands. The trade-off: it also normalizes a wrong form
 * ("estar" became "está"), so that sentence passes. It kept a wrong word, a
 * wrong tense and missing words ("hent", "live", a dropped "the"), and it never
 * flagged a sentence said right. It gets the language hint and the prompt as
 * context, never the expected words: as `keywords` they hid three more
 * mistakes. The fallbacks run through AI Gateway: gpt-4o-transcribe, then
 * Gemini on another provider.
 */
const defaultModel: TranscriptionModelId = "openai/gpt-transcribe";
const fallbackModels = ["openai/gpt-4o-transcribe", "google/gemini-3.5-transcribe"] as const;

const DIRECT_MODEL = "openai/gpt-transcribe";

/**
 * The instructions sent with every request. They ask for what was said, not
 * what was meant, and never include the expected answer, which would bias the
 * model toward "hearing" it.
 */
const TRANSCRIPTION_PROMPT =
  "A language learner is practicing. Write exactly the words you hear, including mispronounced words, wrong grammar and wrong words. Never correct them.";

/** Changes to how models are called that the prompt text doesn't show. */
const TRANSCRIPTION_VERSION = "2";

export type TranscribeSpeechParams = {
  audio: Uint8Array;
  /** The language the learner is speaking: the target language of the step. */
  language: string;
  model?: TranscriptionModelId;
  useFallback?: boolean;
  analytics?: AiGenerationContext;
};

export type SpeechTranscript = { text: string };

function getTranscriptionModel(model: TranscriptionModelId) {
  if (model === DIRECT_MODEL) {
    return directOpenAI.transcription("gpt-transcribe");
  }

  return zoonkGateway.transcriptionModel(model);
}

/**
 * OpenAI's models take a language hint and free-text context; Gemini detects
 * the language on its own. OpenAI documents a `languages` list for
 * gpt-transcribe, which the AI SDK (4.0.78) can't send yet, but gpt-transcribe
 * honors the single `language` it does send (checked 28 Sep 2026). The SDK
 * asks models it doesn't know for `verbose_json`, which gpt-transcribe
 * rejects, so every OpenAI call asks for plain JSON.
 */
function getOpenAIOptions(language: string): OpenAITranscriptionModelOptions {
  return {
    language: language.split("-")[0] ?? language,
    prompt: TRANSCRIPTION_PROMPT,
    responseFormat: "json",
  };
}

async function transcribeWithModel({
  audio,
  language,
  model,
}: {
  audio: Uint8Array;
  language: string;
  model: TranscriptionModelId;
}): Promise<{ audioSeconds?: number; text: string }> {
  const result = await transcribe({
    audio,
    model: getTranscriptionModel(model),
    ...(model.startsWith("openai/")
      ? { providerOptions: { openai: getOpenAIOptions(language) } }
      : {}),
  });

  return { audioSeconds: result.durationInSeconds, text: result.text.trim() };
}

/**
 * Provenance for a call that has no tokens: transcription is billed by audio
 * length, priced from the duration the model reports; a model that doesn't
 * report one leaves the cost unknown.
 */
function buildTranscriptionProvenance({
  audioSeconds,
  latencyMs,
  model,
  requestedModel,
}: {
  audioSeconds?: number;
  latencyMs: number;
  model: TranscriptionModelId;
  requestedModel: TranscriptionModelId;
}): TaskProvenance {
  const usage = { audioSeconds };

  return {
    costUsd: audioSeconds === undefined ? undefined : computeCallCostUsd({ model, usage }),
    generatedAt: new Date().toISOString(),
    latencyMs,
    model,
    promptVersion: getPromptVersion({
      systemPrompt: TRANSCRIPTION_PROMPT,
      version: TRANSCRIPTION_VERSION,
    }),
    provider: model.split("/")[0] ?? model,
    requestedModel,
    runId: randomUUID(),
    usage,
  };
}

async function transcribeInOrder({
  audio,
  language,
  models,
}: {
  audio: Uint8Array;
  language: string;
  models: readonly TranscriptionModelId[];
}): Promise<{ audioSeconds?: number; model: TranscriptionModelId; text: string }> {
  const [model, ...remaining] = models;

  if (!model) {
    throw new Error("No transcription model configured");
  }

  try {
    return { model, ...(await transcribeWithModel({ audio, language, model })) };
  } catch (error) {
    if (remaining.length === 0) {
      throw error;
    }

    return transcribeInOrder({ audio, language, models: remaining });
  }
}

/**
 * Transcribes a learner's spoken answer as said, mistakes included, so code
 * can compare it with the expected sentence word by word. The audio is only
 * sent to the model; nothing here stores it.
 */
export async function transcribeSpeech({
  analytics,
  audio,
  language,
  model = defaultModel,
  useFallback = true,
}: TranscribeSpeechParams) {
  const startedAt = performance.now();

  const models = useFallback
    ? [model, ...fallbackModels.filter((item) => item !== model)]
    : [model];

  const result = await transcribeInOrder({ audio, language, models });

  const provenance = buildTranscriptionProvenance({
    audioSeconds: result.audioSeconds,
    latencyMs: Math.round(performance.now() - startedAt),
    model: result.model,
    requestedModel: model,
  });

  await captureAiGeneration({ context: analytics, provenance, task: "transcribe-speech" });

  return { data: { text: result.text } satisfies SpeechTranscript, provenance };
}
