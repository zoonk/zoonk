const TOKENS_PER_MILLION = 1_000_000;

/**
 * Model configurations with pricing information.
 * Prices are in USD per million tokens.
 */
export interface ModelConfig {
  id: string;
  name: string;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
  reasoningEffort?: "low" | "medium" | "high";
}

export const EVAL_MODELS: ModelConfig[] = [
  {
    id: "openai/gpt-4.1",
    name: "gpt-4.1",
    inputCostPerMillion: 2.5,
    outputCostPerMillion: 10.0,
  },
  {
    id: "openai/gpt-4.1-nano",
    name: "gpt-4.1-nano",
    inputCostPerMillion: 0.15,
    outputCostPerMillion: 0.6,
  },
  {
    id: "openai/gpt-5",
    name: "gpt-5",
    inputCostPerMillion: 10.0,
    outputCostPerMillion: 40.0,
    reasoningEffort: "low",
  },
];

/**
 * Model used for scoring/evaluation.
 */
export const SCORER_MODEL: ModelConfig = {
  id: "openai/gpt-5",
  name: "gpt-5",
  inputCostPerMillion: 10.0,
  outputCostPerMillion: 40.0,
  reasoningEffort: "high",
};

/**
 * Calculate cost for a given usage.
 */
export function calculateCost(
  usage: { promptTokens: number; completionTokens: number },
  model: ModelConfig,
): number {
  const inputCost =
    (usage.promptTokens / TOKENS_PER_MILLION) * model.inputCostPerMillion;
  const outputCost =
    (usage.completionTokens / TOKENS_PER_MILLION) * model.outputCostPerMillion;
  return inputCost + outputCost;
}

/**
 * Get display name for a model (includes reasoning effort if applicable).
 */
export function getModelDisplayName(model: ModelConfig): string {
  if (model.reasoningEffort) {
    return `${model.name} (${model.reasoningEffort})`;
  }
  return model.name;
}
