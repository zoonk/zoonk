import {
  JEV_MODEL_ID,
  LUNA_DECISIONS_MODEL_ID,
  isNativeEvaluationModel,
} from "@zoonk/ai/evaluate/models";
import { type Reasoning } from "@zoonk/ai/provider-options";

type ModelKind = "generation" | "evaluation" | "image" | "speech" | "transcription";

export type ModelConfig = {
  id: string;
  name: string;
  kind: ModelKind;
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
  { id: "google/gemini-4-argon", name: "gemini-4-argon" },
  { id: "google/gemini-3.8-flash", name: "gemini-3.8-flash" },
  { id: "google/gemini-3.5-flash-lite", name: "gemini-3.5-flash-lite" },
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
];

const EVALUATION_MODELS: { gatewayModelId: string; name: string }[] = [
  { gatewayModelId: JEV_MODEL_ID, name: "jev" },
  { gatewayModelId: LUNA_DECISIONS_MODEL_ID, name: "gpt-6-luna-decisions" },
  { gatewayModelId: "liquid/d1", name: "liquid-d1" },
  { gatewayModelId: "openai/gpt-6-luna", name: "gpt-6-luna (evaluation)" },
  { gatewayModelId: "google/gemini-3.5-flash-lite", name: "gemini-3.5-flash-lite (evaluation)" },
  { gatewayModelId: "anthropic/claude-haiku-5.5", name: "claude-haiku-5.5 (evaluation)" },
  { gatewayModelId: "anthropic/claude-haiku-4.5", name: "claude-haiku-4.5 (evaluation)" },
];

const IMAGE_MODELS: { id: string; name: string }[] = [
  { id: "openai/gpt-image-2.5-flare", name: "gpt-image-2.5-flare" },
  { id: "openai/gpt-image-2.5-sunburst", name: "gpt-image-2.5-sunburst" },
  { id: "openai/gpt-image-2", name: "gpt-image-2" },
];

const SPEECH_MODELS: { id: string; name: string }[] = [
  { id: "google/gemini-3.8-flash-tts", name: "gemini-3.8-flash-tts" },
  { id: "google/gemini-3.8-flash-lite-tts", name: "gemini-3.8-flash-lite-tts" },
  { id: "microsoft/mai-voice-2.1-flash", name: "mai-voice-2.1-flash" },
];

const TRANSCRIPTION_MODELS: { id: string; name: string }[] = [
  { id: "openai/gpt-transcribe", name: "gpt-transcribe" },
  { id: "google/gemini-3.5-transcribe", name: "gemini-3.5-transcribe" },
  { id: "microsoft/mai-transcribe-2", name: "mai-transcribe-2" },
  { id: "fish-audio/transcribe-1", name: "fish-audio-transcribe-1" },
  { id: "spacexai/grok-stt", name: "grok-stt" },
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
  ...SPEECH_MODELS.map((model) => ({
    ...model,
    gatewayModelId: model.id,
    kind: "speech" as const,
  })),
  ...TRANSCRIPTION_MODELS.map((model) => ({
    ...model,
    gatewayModelId: model.id,
    kind: "transcription" as const,
  })),
];

export function getModelFamily(model: Pick<ModelConfig, "gatewayModelId">): string {
  return model.gatewayModelId.split("/")[0] ?? model.gatewayModelId;
}

export function getReasoningLabel(reasoning: Reasoning = DEFAULT_REASONING): string {
  return REASONING_OPTIONS.find((option) => option.value === reasoning)?.label ?? reasoning;
}

export function getModelDisplayName(model: ModelConfig): string {
  if (model.reasoning) {
    return `${model.name} (${getReasoningLabel(model.reasoning)})`;
  }

  return model.name;
}

export function parseReasoning(value: string | null): Reasoning | null {
  return REASONING_OPTIONS.find((option) => option.value === value)?.value ?? null;
}

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

export function getModelById(modelId: string): ModelConfig | null {
  const variant = parseReasoningVariantId(modelId);
  const model = variant && EVAL_MODELS.find((item) => item.id === variant.configuredModelId);

  if (!model || (variant.reasoning && model.kind !== "generation")) {
    return null;
  }

  return variant.reasoning ? { ...model, id: modelId, reasoning: variant.reasoning } : model;
}

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

function getFamilyFromId(modelId: string): string {
  const model = getModelById(modelId);
  return model ? getModelFamily(model) : (modelId.split("/")[0] ?? modelId);
}

export function canJudge({ judgeId, modelId }: { judgeId: string; modelId: string }): boolean {
  return getFamilyFromId(judgeId) !== getFamilyFromId(modelId);
}
