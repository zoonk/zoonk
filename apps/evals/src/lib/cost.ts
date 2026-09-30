import { type GatewayPrices, type ModelPricing, type PriceTier } from "./gateway-prices";
import { average } from "./math";
import { type TokenUsage } from "./types";

/**
 * Long-context tiers switch on the prompt size, so every rate for a call is
 * picked from its input token count, as the gateway bills it.
 */
function getRate({
  base,
  inputTokens,
  tiers,
}: {
  base: number;
  inputTokens: number;
  tiers?: PriceTier[];
}): number {
  const tier = tiers?.find(
    (item) => inputTokens >= (item.min ?? 0) && (item.max === undefined || inputTokens < item.max),
  );

  return tier?.cost ?? base;
}

/**
 * Prices one call in dollars. Cached reads and writes use their own rates when
 * the model has them. The AI SDK counts reasoning inside output tokens, so
 * reasoning is billed at the output rate without being added twice.
 */
function calculateUsageCost({
  pricing,
  usage,
}: {
  pricing: ModelPricing;
  usage: TokenUsage;
}): number {
  const { inputTokens } = usage;
  const cacheReadTokens = usage.cacheReadTokens ?? 0;
  const cacheWriteTokens = usage.cacheWriteTokens ?? 0;
  const uncachedInputTokens = Math.max(0, inputTokens - cacheReadTokens - cacheWriteTokens);

  const inputRate = getRate({ base: pricing.input, inputTokens, tiers: pricing.inputTiers });

  const cacheReadRate = getRate({
    base: pricing.inputCacheRead ?? inputRate,
    inputTokens,
    tiers: pricing.inputCacheReadTiers,
  });

  const cacheWriteRate = getRate({
    base: pricing.inputCacheWrite ?? inputRate,
    inputTokens,
    tiers: pricing.inputCacheWriteTiers,
  });

  const outputRate = getRate({ base: pricing.output, inputTokens, tiers: pricing.outputTiers });

  return (
    uncachedInputTokens * inputRate +
    cacheReadTokens * cacheReadRate +
    cacheWriteTokens * cacheWriteRate +
    usage.outputTokens * outputRate
  );
}

const RUNS_PER_COST_ESTIMATE = 1000;

/** Per-call costs are fractions of a cent, so dashboards compare the cost of 1,000 runs. */
export function estimateCostPer1000Runs(runCosts: number[]): number {
  return average(runCosts) * RUNS_PER_COST_ESTIMATE;
}

/**
 * Prices a call with a gateway model id. Unknown models throw instead of
 * costing zero, since a silent zero would make a model look free.
 */
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
    throw new Error(`No gateway price for ${modelId}. Run pnpm prices:refresh.`);
  }

  return calculateUsageCost({ pricing, usage });
}
