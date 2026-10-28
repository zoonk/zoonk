import { getModelFamily } from "../../_utils/model-family";
import { computeCallCostUsd } from "../../pricing/call-cost";
import { readGatewayMetadata } from "../../provenance/gateway-metadata";
import { type TaskProvenance } from "../../provenance/task-provenance";
import { type SpeechModelName } from "./speech-models";

/** The SDK doesn't report a speech call's text tokens, a small part of its price. */
const CHARACTERS_PER_TEXT_TOKEN = 4;

/**
 * Speech is billed by the second of audio and the text read, or by the characters of the clip's
 * words alone (MAI-Voice).
 */
export function buildSpeechProvenance({
  instructions,
  latencyMs,
  promptVersion,
  requestedModel,
  runId,
  text,
  voiced,
}: {
  instructions: string;
  latencyMs: number;
  promptVersion: string;
  requestedModel: SpeechModelName;
  runId: string;
  text: string;
  voiced: {
    durationSeconds: number;
    model: SpeechModelName;
    providerMetadata: Record<string, unknown>;
  };
}): TaskProvenance {
  const gateway = readGatewayMetadata(voiced.providerMetadata);

  const usage = {
    audioSeconds: voiced.durationSeconds,
    characters: text.length,
    inputTokens: Math.ceil(`${instructions}\n${text}`.length / CHARACTERS_PER_TEXT_TOKEN),
  };

  return {
    costUsd: computeCallCostUsd({ model: voiced.model, serviceTier: gateway.serviceTier, usage }),
    credential: gateway.credential,
    gatewayCostUsd: gateway.costUsd,
    generatedAt: new Date().toISOString(),
    latencyMs,
    model: voiced.model,
    promptVersion,
    provider: gateway.servedProvider ?? getModelFamily(voiced.model),
    requestedModel,
    runId,
    serviceTier: gateway.serviceTier,
    usage,
  };
}
