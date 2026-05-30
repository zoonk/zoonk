export type ModelConfig = {
  id: string;
  name: string;
  inputCost: number;
  outputCost: number;
  reasoningEffort?: "auto" | "low" | "medium" | "high";
};

export const EVAL_MODELS: ModelConfig[] = [
  { id: "anthropic/claude-opus-4.8", inputCost: 5, name: "claude-opus-4.8", outputCost: 25 },
  { id: "anthropic/claude-opus-4.7", inputCost: 5, name: "claude-opus-4.7", outputCost: 25 },
  { id: "anthropic/claude-sonnet-4.6", inputCost: 3, name: "claude-sonnet-4.6", outputCost: 15 },
  { id: "anthropic/claude-haiku-4.5", inputCost: 1, name: "claude-haiku-4.5", outputCost: 5 },
  { id: "deepseek/deepseek-v4-pro", inputCost: 0.43, name: "deepseek-v4-pro", outputCost: 0.87 },
  {
    id: "deepseek/deepseek-v4-flash",
    inputCost: 0.14,
    name: "deepseek-v4-flash",
    outputCost: 0.28,
  },
  { id: "google/gemini-3.5-flash", inputCost: 1.5, name: "gemini-3.5-flash", outputCost: 9 },
  { id: "google/gemini-3.1-pro-preview", inputCost: 2, name: "gemini-3.1-pro", outputCost: 12 },
  {
    id: "google/gemini-3.1-flash-lite",
    inputCost: 0.25,
    name: "gemini-3.1-flash-lite",
    outputCost: 1.5,
  },
  { id: "google/gemini-3-flash", inputCost: 0.5, name: "gemini-3-flash", outputCost: 3 },
  { id: "openai/gpt-5.5", inputCost: 5, name: "gpt-5.5", outputCost: 30 },
  { id: "openai/gpt-5.4", inputCost: 1.75, name: "gpt-5.4", outputCost: 14 },
  { id: "openai/gpt-5.4-mini", inputCost: 0.75, name: "gpt-5.4-mini", outputCost: 4.5 },
  { id: "openai/gpt-5.4-nano", inputCost: 0.2, name: "gpt-5.4-nano", outputCost: 1.25 },
  { id: "xai/grok-4.3", inputCost: 1.25, name: "grok-4.3", outputCost: 2.5 },
];

export function getModelDisplayName(model: ModelConfig): string {
  if (model.reasoningEffort) {
    return `${model.name} (${model.reasoningEffort})`;
  }

  return model.name;
}

export function getModelById(modelId: string): ModelConfig | null {
  return EVAL_MODELS.find((model) => model.id === modelId) ?? null;
}

/**
 * Get the base model ID to pass to the AI gateway.
 * Strips any reasoning effort suffix (e.g., "openai/gpt-5.2:high" -> "openai/gpt-5.2")
 */
export function getGatewayModelId(modelId: string): string {
  const colonIndex = modelId.indexOf(":");
  return colonIndex === -1 ? modelId : modelId.slice(0, colonIndex);
}
