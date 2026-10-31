import "server-only";
import { type OpenAITranscriptionModelOptions } from "@ai-sdk/openai";
import { getBaseLanguage } from "@zoonk/utils/languages";
import { type TranscriptionResult, transcribe } from "ai";
import { getModelFamily } from "../../_utils/model-family";
import { NO_PROMPT_TRAINING } from "../../data-protection";
import { zoonkGateway } from "../../gateway";
import { computeCallCostUsd } from "../../pricing/call-cost";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { readGatewayMetadata } from "../../provenance/gateway-metadata";
import { type TaskRunDetails, startTaskRun } from "../../provenance/run-task-generation";
import { type TaskProvenance } from "../../provenance/task-provenance";

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

/** Never includes the expected answer, which would bias the model toward "hearing" it. */
const TRANSCRIPTION_PROMPT =
  "A language learner is practicing. Write exactly the words you hear, including mispronounced words, wrong grammar and wrong words. Never correct them.";

/** Changes to how models are called that the prompt text doesn't show. */
const TRANSCRIPTION_VERSION = "3";

export type TranscribeSpeechParams = {
  audio: Uint8Array;
  language: string;
  model?: TranscriptionModelId;
  analytics?: AiGenerationContext;
};

export type SpeechTranscript = { text: string };

/** Given the locale, MAI-Transcribe rejects a language it can't hear instead of guessing one. */
function getProviderOptions(language: string) {
  const code = getBaseLanguage(language);

  return {
    azure: { locales: [code] },
    gateway: NO_PROMPT_TRAINING,
    openai: {
      language: code,
      prompt: TRANSCRIPTION_PROMPT,
    } satisfies OpenAITranscriptionModelOptions,
  };
}

/** Billed by audio length: a model that doesn't report a duration leaves the cost unknown. */
function buildTranscriptionProvenance({
  details,
  requestedModel,
  result,
}: {
  details: TaskRunDetails;
  requestedModel: TranscriptionModelId;
  result: Pick<TranscriptionResult, "durationInSeconds" | "providerMetadata">;
}): TaskProvenance {
  const gateway = readGatewayMetadata(result.providerMetadata);
  const model = gateway.servedModel ?? requestedModel;
  const usage = { audioSeconds: result.durationInSeconds };

  return {
    ...details,
    costUsd: usage.audioSeconds === undefined ? undefined : computeCallCostUsd({ model, usage }),
    credential: gateway.credential,
    gatewayCostUsd: gateway.costUsd,
    model,
    provider: gateway.servedProvider ?? getModelFamily(model),
    requestedModel,
    usage,
  };
}

/**
 * The audio is only sent to the model; nothing here stores it. The default model, gpt-transcribe,
 * rejects a language it doesn't support, such as Irish or Malagasy; other models may return wrong
 * text instead. It has no fallback: no other gateway model reads the WebM and MP4 learners record
 * and also refuses a language it can't hear.
 */
export async function transcribeSpeech({
  analytics,
  audio,
  language,
  model = defaultModel,
}: TranscribeSpeechParams) {
  const run = startTaskRun({
    analytics,
    promptVersion: TRANSCRIPTION_VERSION,
    systemPrompt: TRANSCRIPTION_PROMPT,
    task: "transcribe-speech",
  });

  const result = await transcribe({
    audio,
    model: zoonkGateway.transcriptionModel(model),
    providerOptions: getProviderOptions(language),
  });

  const provenance = await run.finish((details) =>
    buildTranscriptionProvenance({ details, requestedModel: model, result }),
  );

  return { data: { text: result.text.trim() } satisfies SpeechTranscript, provenance };
}
