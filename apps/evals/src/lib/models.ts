import { type Reasoning } from "@zoonk/ai/provider-options";

export type ModelConfig = {
  id: string;
  name: string;
  inputCost: number;
  outputCost: number;
  reasoning?: Reasoning;
};

export const DEFAULT_REASONING: Reasoning = "provider-default";

export const REASONING_OPTIONS = [
  { label: "Provider default", value: DEFAULT_REASONING },
  { label: "None", value: "none" },
  { label: "Minimal", value: "minimal" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Extra high", value: "xhigh" },
] as const satisfies readonly { label: string; value: Reasoning }[];

export const EVAL_MODELS: ModelConfig[] = [
  { id: "anthropic/claude-fable-5", inputCost: 10, name: "claude-fable-5", outputCost: 50 },
  { id: "anthropic/claude-opus-5", inputCost: 5, name: "claude-opus-5", outputCost: 25 },
  { id: "anthropic/claude-opus-4.8", inputCost: 5, name: "claude-opus-4.8", outputCost: 25 },
  { id: "anthropic/claude-sonnet-5", inputCost: 2, name: "claude-sonnet-5", outputCost: 10 },
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
  { id: "openai/gpt-5.6-sol", inputCost: 4, name: "gpt-5.6-sol", outputCost: 20 },
  { id: "openai/gpt-5.6-terra", inputCost: 2, name: "gpt-5.6-terra", outputCost: 12 },
  { id: "openai/gpt-5.6-luna", inputCost: 0.2, name: "gpt-5.6-luna", outputCost: 1.2 },
  { id: "openai/gpt-5.5", inputCost: 5, name: "gpt-5.5", outputCost: 30 },
  { id: "openai/gpt-5.4", inputCost: 1.75, name: "gpt-5.4", outputCost: 14 },
  { id: "openai/gpt-5.4-mini", inputCost: 0.75, name: "gpt-5.4-mini", outputCost: 4.5 },
  { id: "openai/gpt-5.4-nano", inputCost: 0.2, name: "gpt-5.4-nano", outputCost: 1.25 },
  { id: "xai/grok-4.5", inputCost: 2, name: "grok-4.5", outputCost: 6 },
  { id: "xai/grok-4.3", inputCost: 1.25, name: "grok-4.3", outputCost: 2.5 },
];

/**
 * Gives each portable AI SDK reasoning value a concise label for selectors,
 * breadcrumbs, and comparison tables.
 */
export function getReasoningLabel(reasoning: Reasoning = DEFAULT_REASONING): string {
  return REASONING_OPTIONS.find((option) => option.value === reasoning)?.label ?? reasoning;
}

export function getModelDisplayName(model: ModelConfig): string {
  if (model.reasoning) {
    return `${model.name} (${getReasoningLabel(model.reasoning)})`;
  }

  return model.name;
}

/**
 * Accepts only reasoning values supported by AI SDK's portable top-level
 * reasoning option so untrusted form and route values cannot reach generation.
 */
export function parseReasoning(value: string | null): Reasoning | null {
  return REASONING_OPTIONS.find((option) => option.value === value)?.value ?? null;
}

/**
 * Separates a saved evaluation id into its configured gateway model and optional
 * reasoning level. Provider-default evaluations intentionally keep the original
 * unsuffixed model id so existing output and result files remain compatible.
 */
function parseModelEvaluationId(
  modelId: string,
): { gatewayModelId: string; reasoning?: Reasoning } | null {
  const separatorIndex = modelId.lastIndexOf(":");

  if (separatorIndex === -1) {
    return { gatewayModelId: modelId };
  }

  const reasoning = parseReasoning(modelId.slice(separatorIndex + 1));

  if (!reasoning || reasoning === DEFAULT_REASONING) {
    return null;
  }

  return { gatewayModelId: modelId.slice(0, separatorIndex), reasoning };
}

/**
 * Resolves both configured models and their saved reasoning variants. Variants
 * inherit pricing and display metadata from the configured gateway model while
 * retaining their unique id for output, score, and leaderboard isolation.
 */
export function getModelById(modelId: string): ModelConfig | null {
  const evaluation = parseModelEvaluationId(modelId);

  if (!evaluation) {
    return null;
  }

  const model = EVAL_MODELS.find((item) => item.id === evaluation.gatewayModelId);

  if (!model) {
    return null;
  }

  return evaluation.reasoning ? { ...model, id: modelId, reasoning: evaluation.reasoning } : model;
}

/**
 * Get the base model ID to pass to the AI gateway.
 * Strips any reasoning suffix (e.g., "openai/gpt-5.2:high" -> "openai/gpt-5.2")
 */
export function getGatewayModelId(modelId: string): string {
  return parseModelEvaluationId(modelId)?.gatewayModelId ?? modelId;
}

/**
 * Builds the stable id used to isolate generated outputs and scores for one
 * model/reasoning pair. Provider-default reuses the base id for compatibility.
 */
export function getModelEvaluationId({
  modelId,
  reasoning,
}: {
  modelId: string;
  reasoning: Reasoning;
}): string {
  const gatewayModelId = getGatewayModelId(modelId);
  return reasoning === DEFAULT_REASONING ? gatewayModelId : `${gatewayModelId}:${reasoning}`;
}
