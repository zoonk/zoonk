import "server-only";
import { randomUUID } from "node:crypto";
import { type OpenAITranscriptionModelOptions } from "@ai-sdk/openai";
import { getPromptVersion } from "@zoonk/utils/prompt-version";
import { transcribe } from "ai";
import { NO_PROMPT_TRAINING } from "../../data-protection";
import { directOpenAI } from "../../direct-providers";
import { zoonkGateway } from "../../gateway";
import { computeCallCostUsd } from "../../pricing/call-cost";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { captureAiGeneration } from "../../provenance/ai-generation-sink";
import { type TaskProvenance } from "../../provenance/task-provenance";

/** gpt-transcribe goes to OpenAI directly because AI Gateway doesn't list it. */
export const TRANSCRIPTION_MODELS = [
  "openai/gpt-transcribe",
  "google/gemini-3.5-transcribe",
  "microsoft/mai-transcribe-2",
  "spacexai/grok-stt",
] as const;

export type TranscriptionModelId = (typeof TRANSCRIPTION_MODELS)[number];

/**
 * gpt-transcribe hears slips the way a listener would and matched 12 of 13 labeled clips at 1.0s
 * p50 (28 Sep 2026). It never gets the expected words: as `keywords` they hid three more mistakes.
 */
const defaultModel: TranscriptionModelId = "openai/gpt-transcribe";

const DIRECT_MODEL = "openai/gpt-transcribe";

/** Never includes the expected answer, which would bias the model toward "hearing" it. */
const TRANSCRIPTION_PROMPT =
  "A language learner is practicing. Write exactly the words you hear, including mispronounced words, wrong grammar and wrong words. Never correct them.";

/** Changes to how models are called that the prompt text doesn't show. */
const TRANSCRIPTION_VERSION = "2";

export type TranscribeSpeechParams = {
  audio: Uint8Array;
  language: string;
  model?: TranscriptionModelId;
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
 * The AI SDK (4.0.78) can't send gpt-transcribe's `languages` list, but it honors `language` (28
 * Sep 2026). The SDK asks unknown models for `verbose_json`, which gpt-transcribe rejects.
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
    providerOptions: model.startsWith("openai/")
      ? { openai: getOpenAIOptions(language) }
      : { gateway: NO_PROMPT_TRAINING },
  });

  return { audioSeconds: result.durationInSeconds, text: result.text.trim() };
}

/** Billed by audio length: a model that doesn't report a duration leaves the cost unknown. */
function buildTranscriptionProvenance({
  audioSeconds,
  latencyMs,
  model,
}: {
  audioSeconds?: number;
  latencyMs: number;
  model: TranscriptionModelId;
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
    requestedModel: model,
    runId: randomUUID(),
    usage,
  };
}

/**
 * The audio is only sent to the model; nothing here stores it. The default model, gpt-transcribe,
 * rejects a language it doesn't support, such as Irish or Malagasy; other models may return wrong
 * text instead.
 */
export async function transcribeSpeech({
  analytics,
  audio,
  language,
  model = defaultModel,
}: TranscribeSpeechParams) {
  const startedAt = performance.now();
  const result = await transcribeWithModel({ audio, language, model });

  const provenance = buildTranscriptionProvenance({
    audioSeconds: result.audioSeconds,
    latencyMs: Math.round(performance.now() - startedAt),
    model,
  });

  await captureAiGeneration({ context: analytics, provenance, task: "transcribe-speech" });

  return { data: { text: result.text } satisfies SpeechTranscript, provenance };
}
