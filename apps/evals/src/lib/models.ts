export interface ModelConfig {
  id: string;
  name: string;
  inputCost: number;
  outputCost: number;
  reasoningEffort?: "auto" | "low" | "medium" | "high";
}

export const EVAL_MODELS: ModelConfig[] = [
  {
    id: "openai/gpt-5",
    name: "gpt-5",
    inputCost: 1.25,
    outputCost: 10,
    reasoningEffort: "auto",
  },
  {
    id: "openai/gpt-5-mini",
    name: "gpt-5-mini",
    inputCost: 0.25,
    outputCost: 2,
    reasoningEffort: "auto",
  },
  {
    id: "openai/gpt-5-nano",
    name: "gpt-5-nano",
    inputCost: 0.05,
    outputCost: 0.4,
    reasoningEffort: "auto",
  },
  {
    id: "openai/gpt-4.1",
    name: "gpt-4.1",
    inputCost: 2,
    outputCost: 8,
  },
  {
    id: "openai/gpt-4.1-mini",
    name: "gpt-4.1-mini",
    inputCost: 0.4,
    outputCost: 1.6,
  },
  {
    id: "openai/gpt-4.1-nano",
    name: "gpt-4.1-nano",
    inputCost: 0.1,
    outputCost: 0.4,
  },
];

export function getModelDisplayName(model: ModelConfig): string {
  if (model.reasoningEffort) {
    return `${model.name} (${model.reasoningEffort})`;
  }

  return model.name;
}

export function getModelById(modelId: string): ModelConfig | undefined {
  return EVAL_MODELS.find((model) => model.id === modelId);
}
