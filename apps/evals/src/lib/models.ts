export type ModelConfig = {
  id: string;
  name: string;
  inputCost: number;
  outputCost: number;
  reasoningEffort?: "auto" | "low" | "medium" | "high";
};

export const EVAL_MODELS: ModelConfig[] = [
  {
    id: "anthropic/claude-opus-4.6",
    inputCost: 5,
    name: "claude-opus-4.6",
    outputCost: 25,
  },
  {
    id: "anthropic/claude-sonnet-4.6",
    inputCost: 3,
    name: "claude-sonnet-4.6",
    outputCost: 15,
  },
  {
    id: "anthropic/claude-haiku-4.5",
    inputCost: 1,
    name: "claude-haiku-4.5",
    outputCost: 5,
  },
  {
    id: "google/gemini-3.1-pro-preview",
    inputCost: 2,
    name: "gemini-3.1-pro",
    outputCost: 12,
  },
  {
    id: "google/gemini-3-flash",
    inputCost: 0.5,
    name: "gemini-3-flash",
    outputCost: 3,
  },
  {
    id: "openai/gpt-5-mini",
    inputCost: 0.25,
    name: "gpt-5-mini",
    outputCost: 2,
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
    id: "openai/gpt-5.2",
    inputCost: 1.75,
    name: "gpt-5.2",
    outputCost: 14,
    reasoningEffort: "auto",
  },
  {
    id: "openai/gpt-5.2:high",
    inputCost: 1.75,
    name: "gpt-5.2",
    outputCost: 14,
    reasoningEffort: "high",
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

/**
 * Get the base model ID to pass to the AI gateway.
 * Strips any reasoning effort suffix (e.g., "openai/gpt-5.2:high" -> "openai/gpt-5.2")
 */
export function getGatewayModelId(modelId: string): string {
  const colonIndex = modelId.indexOf(":");
  return colonIndex === -1 ? modelId : modelId.slice(0, colonIndex);
}
