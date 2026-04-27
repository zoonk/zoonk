import { type GatewayProviderOptions } from "@ai-sdk/gateway";
import { type OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
import { type ImageModel } from "ai";
import { buildGatewayReportingTags } from "./reporting-tags";

export type ReasoningEffort = "auto" | "low" | "medium" | "high";
export type ImageGenerationQuality = "auto" | "low" | "medium" | "high";

const providerOrderByModelPrefix = {
  anthropic: ["anthropic", "vertex", "openai", "azure", "google"],
  google: ["google", "vertex", "openai", "azure", "anthropic"],
  openai: ["openai", "azure", "google", "anthropic", "vertex"],
} satisfies Record<string, string[]>;

type SupportedModelPrefix = keyof typeof providerOrderByModelPrefix;

type ProviderOptionsResult = {
  gateway: Pick<GatewayProviderOptions, "models" | "order" | "tags">;
  openai?: Pick<OpenAILanguageModelResponsesOptions, "reasoningEffort">;
};

type ImageProviderOptionsResult = {
  gateway: Pick<GatewayProviderOptions, "tags">;
  openai: {
    output_format: "webp";
    quality: ImageGenerationQuality;
  };
};

/**
 * Builds the gateway routing options used by our shared text-generation helper.
 * We keep this logic centralized so every task prefers the provider that matches
 * the primary model first, then uses the same cross-provider fallback order.
 */
function buildGatewayProviderOptions({
  fallbackModels,
  model,
  taskName,
  useFallback,
}: {
  fallbackModels: readonly string[];
  model: string;
  taskName: string;
  useFallback: boolean;
}): ProviderOptionsResult["gateway"] {
  const order = getGatewayProviderOrder(model);
  const tags = shouldAddGatewayTags(useFallback)
    ? buildGatewayTags({ model, taskName })
    : undefined;

  return {
    models: useFallback ? [...fallbackModels] : [],
    ...(order ? { order } : {}),
    ...(tags ? { tags } : {}),
  };
}

/**
 * Returns the provider preference list for a gateway model string.
 * For example, `openai/gpt-5.4` should prefer OpenAI-backed credentials first,
 * while `google/gemini-3-flash` should prefer Google-backed credentials first.
 * Unknown prefixes are left unset so we do not invent routing rules we do not own.
 */
function getGatewayProviderOrder(model: string): GatewayProviderOptions["order"] {
  const modelPrefix = model.split("/")[0] ?? "";

  if (!isSupportedModelPrefix(modelPrefix)) {
    return undefined;
  }

  return providerOrderByModelPrefix[modelPrefix];
}

/**
 * Narrows a raw gateway model prefix to one of the prefixes we explicitly own.
 * This keeps the lookup typed and makes the fallback behavior obvious when a
 * new provider appears before we decide how Zoonk should route it.
 */
function isSupportedModelPrefix(value: string): value is SupportedModelPrefix {
  return value in providerOrderByModelPrefix;
}

/**
 * Builds the reporting tags attached to every gateway-backed task request.
 * We keep the format in one place so custom reporting queries can rely on a
 * stable `task:*` prefix instead of every caller inventing its own shape.
 */
function buildGatewayTags({ model, taskName }: { model: string; taskName: string }): string[] {
  return buildGatewayReportingTags({ model, taskName });
}

/**
 * Image tasks accept either a plain `provider/model` string or a provider model
 * instance. Custom Reporting needs a stable string tag, so this helper converts
 * either shape into the same `provider/model` identifier before we build tags.
 */
function getImageReportingModel(model: ImageModel): string {
  if (typeof model === "string") {
    return model;
  }

  return model.modelId.includes("/") ? model.modelId : `${model.provider}/${model.modelId}`;
}

/**
 * Builds the provider options shared by image-generation tasks.
 * Image requests do not use the text fallback helper, so they need their own
 * small wrapper to keep Custom Reporting tags and the OpenAI image output
 * format in one place instead of drifting across each task entry point.
 */
export function buildImageProviderOptions({
  model,
  quality,
  taskName,
}: {
  model: ImageModel;
  quality: ImageGenerationQuality;
  taskName: string;
}): ImageProviderOptionsResult {
  const tags = isGatewayTaggingEnabled()
    ? buildGatewayTags({ model: getImageReportingModel(model), taskName })
    : undefined;

  return {
    gateway: tags ? { tags } : {},
    openai: {
      output_format: "webp",
      quality,
    },
  };
}

/**
 * Gateway request tags power our cost reporting, but tagged Gateway requests
 * cost money. We keep this behind an explicit env opt-in so environments that
 * do not need reporting can avoid the extra charge by default.
 */
function isGatewayTaggingEnabled(): boolean {
  return process.env.ENABLE_AI_GATEWAY_TAGS === "true";
}

/**
 * We only want analytics for tasks that actually participate in fallback
 * routing, and only in environments that explicitly opted into paid Gateway
 * tags. This keeps eval runs out of Gateway reports while still letting opted-
 * in fallback flows report against the normal task path.
 */
function shouldAddGatewayTags(useFallback: boolean): boolean {
  return useFallback && isGatewayTaggingEnabled();
}

/**
 * Builds the shared provider options object for text-generation tasks.
 * This exists so fallback models, gateway routing, and provider-specific
 * reasoning settings stay consistent across every task in this package.
 */
export function buildProviderOptions({
  model,
  useFallback,
  fallbackModels,
  reasoningEffort,
  taskName,
}: {
  model: string;
  useFallback: boolean;
  fallbackModels: readonly string[];
  reasoningEffort?: ReasoningEffort;
  taskName: string;
}): ProviderOptionsResult {
  const options: ProviderOptionsResult = {
    gateway: buildGatewayProviderOptions({ fallbackModels, model, taskName, useFallback }),
  };

  if (reasoningEffort && reasoningEffort !== "auto") {
    options.openai = { reasoningEffort };
  }

  return options;
}
