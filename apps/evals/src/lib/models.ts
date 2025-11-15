export type ModelConfig = {
  id: string;
  name: string;
  inputCost: number;
  outputCost: number;
  reasoningEffort?: "auto" | "low" | "medium" | "high";
};

export const EVAL_MODELS: ModelConfig[] = [
  {
    id: "anthropic/claude-sonnet-4.5",
    inputCost: 3,
    name: "claude-sonnet-4.5",
    outputCost: 15,
  },
  {
    id: "anthropic/claude-haiku-4.5",
    inputCost: 1,
    name: "claude-haiku-4.5",
    outputCost: 5,
  },
  {
    id: "google/gemini-2.5-pro",
    inputCost: 2.5,
    name: "gemini-2.5-pro",
    outputCost: 10,
  },
  {
    id: "google/gemini-2.5-flash",
    inputCost: 0.3,
    name: "gemini-2.5-flash",
    outputCost: 2.5,
  },
  {
    id: "google/gemini-2.5-flash-lite",
    inputCost: 0.1,
    name: "gemini-2.5-flash-lite",
    outputCost: 0.4,
  },
  {
    id: "meta/llama-4-maverick",
    inputCost: 0.15,
    name: "llama-4-maverick",
    outputCost: 0.6,
  },
  {
    id: "meta/llama-4-scout",
    inputCost: 0.08,
    name: "llama-4-scout",
    outputCost: 0.3,
  },
  {
    id: "minimax/minimax-m2",
    inputCost: 0.15,
    name: "minimax-m2",
    outputCost: 0.45,
  },
  {
    id: "moonshotai/kimi-k2-0905",
    inputCost: 0.6,
    name: "kimi-k2-0905",
    outputCost: 2.5,
  },
  {
    id: "openai/gpt-5",
    inputCost: 1.25,
    name: "gpt-5",
    outputCost: 10,
    reasoningEffort: "auto",
  },
  {
    id: "openai/gpt-5-mini",
    inputCost: 0.25,
    name: "gpt-5-mini",
    outputCost: 2,
    reasoningEffort: "auto",
  },
  {
    id: "openai/gpt-5-nano",
    inputCost: 0.05,
    name: "gpt-5-nano",
    outputCost: 0.4,
    reasoningEffort: "auto",
  },
  {
    id: "openai/gpt-5.1-thinking",
    inputCost: 1.25,
    name: "gpt-5.1-thinking",
    outputCost: 10,
    reasoningEffort: "auto",
  },
  {
    id: "openai/gpt-5.1-instant",
    inputCost: 1.25,
    name: "gpt-5.1-instant",
    outputCost: 10,
    reasoningEffort: "auto",
  },
  {
    id: "openai/gpt-4.1",
    inputCost: 2,
    name: "gpt-4.1",
    outputCost: 8,
  },
  {
    id: "openai/gpt-4.1-mini",
    inputCost: 0.4,
    name: "gpt-4.1-mini",
    outputCost: 1.6,
  },
  {
    id: "openai/gpt-4.1-nano",
    inputCost: 0.1,
    name: "gpt-4.1-nano",
    outputCost: 0.4,
  },
  {
    id: "openai/gpt-oss-120b",
    inputCost: 0.1,
    name: "gpt-oss-120b",
    outputCost: 0.5,
  },
  {
    id: "xai/grok-4",
    inputCost: 3,
    name: "grok-4",
    outputCost: 15,
  },
  {
    id: "xai/grok-4-fast-reasoning",
    inputCost: 0.2,
    name: "grok-4-fast-reasoning",
    outputCost: 0.5,
    reasoningEffort: "auto",
  },
  {
    id: "xai/grok-4-fast-non-reasoning",
    inputCost: 0.2,
    name: "grok-4-fast-non-reasoning",
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
