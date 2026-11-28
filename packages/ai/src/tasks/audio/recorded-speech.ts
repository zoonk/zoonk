import { randomUUID } from "node:crypto";
import { type TTSVoice } from "@zoonk/utils/languages";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { captureAiGeneration } from "../../provenance/ai-generation-sink";
import { type TaskProvenance } from "../../provenance/task-provenance";
import { type ServiceTier } from "../../provider-options";
import { getWavSeconds } from "./speech-limits";
import { type SpeechModelName } from "./speech-models";
import { buildSpeechProvenance } from "./speech-provenance";
import { generateSpeechWithProvider } from "./speech-provider";

/**
 * A voice is billed once it answers, even for audio a check then throws away, so each answer is
 * recorded as it arrives.
 */
export async function generateRecordedSpeech({
  analytics,
  instructions,
  language,
  model,
  promptVersion,
  requestedModel,
  serviceTier,
  task,
  text,
  voice,
}: {
  analytics?: AiGenerationContext;
  instructions: string;
  language: string;
  model: SpeechModelName;
  promptVersion: string;
  requestedModel: SpeechModelName;
  serviceTier?: ServiceTier;
  task: string;
  text: string;
  voice: TTSVoice;
}): Promise<{ audio: Uint8Array; provenance: TaskProvenance }> {
  const startedAt = performance.now();

  const { audio, providerMetadata } = await generateSpeechWithProvider({
    instructions,
    language,
    model,
    ...(serviceTier ? { serviceTier } : {}),
    text,
    voice,
  });

  const provenance = buildSpeechProvenance({
    instructions,
    latencyMs: Math.round(performance.now() - startedAt),
    promptVersion,
    requestedModel,
    runId: randomUUID(),
    text,
    voiced: { durationSeconds: getWavSeconds(audio), model, providerMetadata },
  });

  await captureAiGeneration({ context: analytics, provenance, task });

  return { audio, provenance };
}
