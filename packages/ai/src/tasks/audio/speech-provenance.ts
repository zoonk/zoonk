import { getModelFamily } from "../../_utils/model-family";
import { computeCallCostUsd } from "../../pricing/call-cost";
import { readGatewayMetadata } from "../../provenance/gateway-metadata";
import { type TaskProvenance } from "../../provenance/task-provenance";
import { type SpeechModelName } from "./speech-models";

/**
 * The text a speech model reads (its instructions and the clip's words), in tokens: the SDK
 * doesn't report them, and at about four characters a token they're a small part of the price.
 */
const CHARACTERS_PER_TEXT_TOKEN = 4;

/**
 * Speech is billed by the second of audio it returns and the text it reads (its instructions and
 * the clip's words), or by the characters of the clip's words alone (MAI-Voice), so the clip's
 * length and its words price it. AI Gateway's routing names the provider that served a gateway
 * clip and its own estimate is kept as a cross-check.
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
  /** The clip's words. */
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
