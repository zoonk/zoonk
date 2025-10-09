const TOKENS_PER_MILLION = 1_000_000;
const CALLS_PER_BATCH = 100;

/**
 * Model pricing configuration
 * Costs are in USD per million tokens
 */
export const MODEL_COSTS = {
  "openai/gpt-4.1": {
    input: 2.5,
    output: 10.0,
  },
  "openai/gpt-4.1-nano": {
    input: 0.1,
    output: 0.4,
  },
  "openai/gpt-4o": {
    input: 2.5,
    output: 10.0,
  },
  "openai/gpt-4o-mini": {
    input: 0.15,
    output: 0.6,
  },
  "openai/o1": {
    input: 15.0,
    output: 60.0,
  },
  "openai/o1-mini": {
    input: 3.0,
    output: 12.0,
  },
  "anthropic/claude-3-5-sonnet-latest": {
    input: 3.0,
    output: 15.0,
  },
  "anthropic/claude-3-5-haiku-latest": {
    input: 0.8,
    output: 4.0,
  },
  "google/gemini-2.0-flash-exp": {
    input: 0.0,
    output: 0.0,
  },
} as const;

export type ModelId = keyof typeof MODEL_COSTS;

/**
 * Calculate the cost of a model call in USD
 */
export function calculateCost(
  modelId: ModelId,
  usage: {
    promptTokens: number;
    completionTokens: number;
  },
): number {
  const costs = MODEL_COSTS[modelId];
  if (!costs) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  const inputCost = (usage.promptTokens / TOKENS_PER_MILLION) * costs.input;
  const outputCost =
    (usage.completionTokens / TOKENS_PER_MILLION) * costs.output;

  return inputCost + outputCost;
}

/**
 * Calculate the average cost per 100 calls
 */
export function calculateAverageCostPer100Calls(
  modelId: ModelId,
  usages: Array<{
    promptTokens: number;
    completionTokens: number;
  }>,
): number {
  if (usages.length === 0) {
    return 0;
  }

  const totalCost = usages.reduce(
    (sum, usage) => sum + calculateCost(modelId, usage),
    0,
  );
  const averageCost = totalCost / usages.length;

  return averageCost * CALLS_PER_BATCH;
}
