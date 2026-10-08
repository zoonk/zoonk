import {
  JEV_MODEL_ID,
  LUNA_DECISIONS_MODEL_ID,
  isNativeEvaluationModel,
} from "@zoonk/ai/evaluate/models";
import { type Reasoning } from "@zoonk/ai/provider-options";

/**
 * `generation` models run the task's own prompt through `generate`.
 * `evaluation` models answer through the task's `evaluate` route with
 * `experimental_decide`: Jev natively, other models through the AI SDK's
 * language-model decision adapter. `image` models draw through `generate`
 * and only run tasks whose output is an image; `transcription` models likewise
 * only run tasks whose output is a transcript, and `realtime` models only the
 * live conversation, which talks to them over a realtime session.
 */
type ModelKind = "generation" | "evaluation" | "image" | "realtime" | "transcription";

export type ModelConfig = {
  /** Unique id for saved outputs, results and URLs. */
  id: string;
  name: string;
  kind: ModelKind;
  /** Gateway model id used for calls, prices and model families. */
  gatewayModelId: string;
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

const GENERATION_MODELS: { id: string; name: string }[] = [
  { id: "anthropic/claude-opus-5.5", name: "claude-opus-5.5" },
  { id: "anthropic/claude-fable-5.1", name: "claude-fable-5.1" },
  { id: "anthropic/claude-sonnet-5.5", name: "claude-sonnet-5.5" },
  { id: "anthropic/claude-sonnet-5", name: "claude-sonnet-5" },
  { id: "anthropic/claude-haiku-5.5", name: "claude-haiku-5.5" },
  { id: "anthropic/claude-haiku-4.5", name: "claude-haiku-4.5" },
  { id: "deepseek/deepseek-v4-pro", name: "deepseek-v4-pro" },
  { id: "deepseek/deepseek-v4-flash", name: "deepseek-v4-flash" },
  { id: "google/gemini-3.8-flash", name: "gemini-3.8-flash" },
  { id: "google/gemini-3.5-flash-lite", name: "gemini-3.5-flash-lite" },
  { id: "google/gemini-3.5-flash", name: "gemini-3.5-flash" },
  { id: "google/gemini-3.1-pro-preview", name: "gemini-3.1-pro" },
  { id: "google/gemini-3.1-flash-lite", name: "gemini-3.1-flash-lite" },
  { id: "google/gemini-3-flash", name: "gemini-3-flash" },
  { id: "openai/gpt-6-astra", name: "gpt-6-astra" },
  { id: "openai/gpt-6.1-sol", name: "gpt-6.1-sol" },
  { id: "openai/gpt-6-sol", name: "gpt-6-sol" },
  { id: "openai/gpt-6-luna", name: "gpt-6-luna" },
  { id: "openai/gpt-5.6-sol", name: "gpt-5.6-sol" },
  { id: "openai/gpt-5.6-terra", name: "gpt-5.6-terra" },
  { id: "openai/gpt-5.6-luna", name: "gpt-5.6-luna" },
  { id: "openai/gpt-5.5", name: "gpt-5.5" },
  { id: "openai/gpt-5.4-mini", name: "gpt-5.4-mini" },
  { id: "openai/gpt-5.4-nano", name: "gpt-5.4-nano" },
];

/**
 * Cheap candidates compared with Jev. Language models get an
 * `/evaluation` suffix so their saved results stay apart from the same model
 * running the task's own prompt; native decision models keep their own id.
 */
const EVALUATION_MODELS: { gatewayModelId: string; name: string }[] = [
  { gatewayModelId: JEV_MODEL_ID, name: "jev" },
  { gatewayModelId: LUNA_DECISIONS_MODEL_ID, name: "gpt-6-luna-decisions" },
  { gatewayModelId: "liquid/d1", name: "liquid-d1" },
  { gatewayModelId: "openai/gpt-6-luna", name: "gpt-6-luna (evaluation)" },
  { gatewayModelId: "google/gemini-3.5-flash-lite", name: "gemini-3.5-flash-lite (evaluation)" },
  { gatewayModelId: "anthropic/claude-haiku-5.5", name: "claude-haiku-5.5 (evaluation)" },
  { gatewayModelId: "anthropic/claude-haiku-4.5", name: "claude-haiku-4.5 (evaluation)" },
];

/** Image models compared, all at the low quality setting the tasks use. */
const IMAGE_MODELS: { id: string; name: string }[] = [
  { id: "openai/gpt-image-2.5-flare", name: "gpt-image-2.5-flare" },
  { id: "openai/gpt-image-2.5-sunburst", name: "gpt-image-2.5-sunburst" },
  { id: "openai/gpt-image-2", name: "gpt-image-2" },
];

/**
 * Speech-to-text models compared for spoken answers. gpt-transcribe runs on
 * OpenAI directly (AI Gateway doesn't list it), so it needs OPENAI_API_KEY.
 */
const TRANSCRIPTION_MODELS: { id: string; name: string }[] = [
  { id: "openai/gpt-transcribe", name: "gpt-transcribe" },
  { id: "openai/gpt-4o-transcribe", name: "gpt-4o-transcribe" },
  { id: "openai/gpt-4o-mini-transcribe", name: "gpt-4o-mini-transcribe" },
  { id: "google/gemini-3.5-transcribe", name: "gemini-3.5-transcribe" },
];

/**
 * Voice models for live conversations, driven with text-to-speech learners: GPT-Live (see
 * live-conversation-models) and Gemini Live to compare.
 */
const REALTIME_MODELS: { id: string; name: string }[] = [
  { id: "openai/gpt-live-1", name: "gpt-live-1" },
  { id: "google/gemini-3.8-live", name: "gemini-3.8-live" },
];

export const EVAL_MODELS: ModelConfig[] = [
  ...GENERATION_MODELS.map((model) => ({
    ...model,
    gatewayModelId: model.id,
    kind: "generation" as const,
  })),
  ...EVALUATION_MODELS.map((model) => ({
    ...model,
    id: isNativeEvaluationModel(model.gatewayModelId)
      ? model.gatewayModelId
      : `${model.gatewayModelId}/evaluation`,
    kind: "evaluation" as const,
  })),
  ...IMAGE_MODELS.map((model) => ({ ...model, gatewayModelId: model.id, kind: "image" as const })),
  ...TRANSCRIPTION_MODELS.map((model) => ({
    ...model,
    gatewayModelId: model.id,
    kind: "transcription" as const,
  })),
  ...REALTIME_MODELS.map((model) => ({
    ...model,
    gatewayModelId: model.id,
    kind: "realtime" as const,
  })),
];

/** Judges and contestants from the same provider share training and style biases. */
export function getModelFamily(model: Pick<ModelConfig, "gatewayModelId">): string {
  return model.gatewayModelId.split("/")[0] ?? model.gatewayModelId;
}

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
 * Separates a saved model id into its configured model and optional reasoning
 * level. Provider-default runs intentionally keep the original unsuffixed id so
 * existing output and result files remain compatible.
 */
function parseReasoningVariantId(
  modelId: string,
): { configuredModelId: string; reasoning?: Reasoning } | null {
  const separatorIndex = modelId.lastIndexOf(":");

  if (separatorIndex === -1) {
    return { configuredModelId: modelId };
  }

  const reasoning = parseReasoning(modelId.slice(separatorIndex + 1));

  if (!reasoning || reasoning === DEFAULT_REASONING) {
    return null;
  }

  return { configuredModelId: modelId.slice(0, separatorIndex), reasoning };
}

/**
 * Resolves both configured models and their saved reasoning variants. Variants
 * inherit display metadata and prices from the configured model while keeping
 * their unique id for output, score, and leaderboard isolation. Reasoning
 * variants only exist for generation models; evaluation and image models run without it.
 */
export function getModelById(modelId: string): ModelConfig | null {
  const variant = parseReasoningVariantId(modelId);
  const model = variant && EVAL_MODELS.find((item) => item.id === variant.configuredModelId);

  if (!model || (variant.reasoning && model.kind !== "generation")) {
    return null;
  }

  return variant.reasoning ? { ...model, id: modelId, reasoning: variant.reasoning } : model;
}

/**
 * Builds the stable id used to isolate generated outputs and scores for one
 * model/reasoning pair. Provider-default reuses the base id for compatibility.
 */
export function getModelVariantId({
  modelId,
  reasoning,
}: {
  modelId: string;
  reasoning: Reasoning;
}): string {
  const configuredModelId = parseReasoningVariantId(modelId)?.configuredModelId ?? modelId;
  return reasoning === DEFAULT_REASONING ? configuredModelId : `${configuredModelId}:${reasoning}`;
}

/** Resolves a saved id's family, falling back to its provider prefix for retired models. */
function getFamilyFromId(modelId: string): string {
  const model = getModelById(modelId);
  return model ? getModelFamily(model) : (modelId.split("/")[0] ?? modelId);
}

/**
 * Battle judges never score a model from their own family: an OpenAI judge
 * skips OpenAI outputs, and the same for Anthropic and Google.
 */
export function canJudge({ judgeId, modelId }: { judgeId: string; modelId: string }): boolean {
  return getFamilyFromId(judgeId) !== getFamilyFromId(modelId);
}
