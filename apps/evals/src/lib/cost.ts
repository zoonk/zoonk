import { priceCall } from "@zoonk/ai/pricing/call-cost";
import { type GatewayPrices } from "@zoonk/ai/pricing/gateway-prices";
import { average, sum } from "./math";
import { type ModelConfig } from "./models";
import { type ModelCall, type TokenUsage } from "./types";

const RUNS_PER_COST_ESTIMATE = 1000;

export function estimateCostPer1000Runs(runCosts: number[]): number {
  return average(runCosts) * RUNS_PER_COST_ESTIMATE;
}

/** Throws for unknown model prices so missing pricing cannot make a model look free. */
export function getCallCost({
  modelId,
  prices,
  usage,
}: {
  modelId: string;
  prices: GatewayPrices;
  usage: TokenUsage;
}): number {
  const pricing = prices.models[modelId];

  if (!pricing) {
    throw new Error(`No gateway price for ${modelId}. Run pnpm --filter @zoonk/ai prices:refresh.`);
  }

  return priceCall({ pricing, usage });
}

export function getCallsCost({
  calls,
  prices,
}: {
  calls: ModelCall[];
  prices: GatewayPrices;
}): number {
  return sum(
    calls.map((call) => getCallCost({ modelId: call.modelId, prices, usage: call.usage })),
  );
}

/**
 * Every call a run made. Calls are metered where the provider answers text, so a model that answers
 * anything else (an image, speech, a decision) is priced from the usage its task reported.
 */
export function getRunCost({
  model,
  prices,
  run,
}: {
  model: Pick<ModelConfig, "gatewayModelId" | "kind">;
  prices: GatewayPrices;
  run: TokenUsage & { calls?: ModelCall[] };
}): number {
  const reported = getCallCost({ modelId: model.gatewayModelId, prices, usage: run });

  if (!run.calls) {
    return reported;
  }

  return getCallsCost({ calls: run.calls, prices }) + (model.kind === "generation" ? 0 : reported);
}
