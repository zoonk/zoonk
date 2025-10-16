import type { LanguageModelUsage } from "@zoonk/ai";

const TOKENS_PER_MILLION = 1_000_000;

export interface ModelConfig {
  id: string;
  name: string;
  inputCost: number;
  outputCost: number;
  reasoningEffort?: "low" | "medium" | "high";
}

export const EVAL_MODELS: ModelConfig[] = [
  {
    id: "openai/gpt-4.1",
    name: "gpt-4.1",
    inputCost: 2,
    outputCost: 8,
  },
  {
    id: "openai/gpt-4.1-nano",
    name: "gpt-4.1-nano",
    inputCost: 0.05,
    outputCost: 0.4,
  },
  {
    id: "openai/gpt-5",
    name: "gpt-5",
    inputCost: 1.25,
    outputCost: 10,
    reasoningEffort: "low",
  },
];

export function calculateCost(
  usage: LanguageModelUsage,
  model: ModelConfig,
): number {
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;

  const inputCost = (inputTokens / TOKENS_PER_MILLION) * model.inputCost;
  const outputCost = (outputTokens / TOKENS_PER_MILLION) * model.outputCost;

  return inputCost + outputCost;
}

export function getModelDisplayName(model: ModelConfig): string {
  if (model.reasoningEffort) {
    return `${model.name} (${model.reasoningEffort})`;
  }

  return model.name;
}
