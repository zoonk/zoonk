export interface ModelConfig {
  id: string;
  name: string;
  inputCost: number;
  outputCost: number;
  reasoningEffort?: "auto" | "low" | "medium" | "high";
}

export const EVAL_MODELS: ModelConfig[] = [
  {
    id: "anthropic/claude-sonnet-4.5",
    name: "claude-sonnet-4.5",
    inputCost: 3,
    outputCost: 15,
  },
  {
    id: "anthropic/claude-haiku-4.5",
    name: "claude-haiku-4.5",
    inputCost: 1,
    outputCost: 5,
  },
  {
    id: "google/gemini-2.5-pro",
    name: "gemini-2.5-pro",
    inputCost: 2.5,
    outputCost: 10,
  },
  {
    id: "google/gemini-2.5-flash",
    name: "gemini-2.5-flash",
    inputCost: 0.3,
    outputCost: 2.5,
  },
  {
    id: "google/gemini-2.5-flash-lite",
    name: "gemini-2.5-flash-lite",
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
  {
    id: "xai/grok-4",
    name: "grok-4",
    inputCost: 3,
    outputCost: 15,
  },
  {
    id: "xai/grok-4-fast-reasoning",
    name: "grok-4-fast-reasoning",
    inputCost: 0.2,
    outputCost: 0.5,
    reasoningEffort: "auto",
  },
  {
    id: "xai/grok-4-fast-non-reasoning",
    name: "grok-4-fast-non-reasoning",
    inputCost: 0.2,
    outputCost: 0.5,
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
