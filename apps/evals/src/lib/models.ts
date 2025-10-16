export interface ModelConfig {
  id: string;
  name: string;
  inputCost: number;
  outputCost: number;
  reasoningEffort?: "auto" | "low" | "medium" | "high";
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
    inputCost: 0.1,
    outputCost: 0.4,
  },
  {
    id: "openai/gpt-5",
    name: "gpt-5",
    inputCost: 1.25,
    outputCost: 10,
    reasoningEffort: "auto",
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
