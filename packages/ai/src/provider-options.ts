import { type GatewayProviderOptions } from "@ai-sdk/gateway";
import { type LanguageModelCallOptions } from "ai";

export type Reasoning = NonNullable<LanguageModelCallOptions["reasoning"]>;
export type ImageGenerationQuality = "auto" | "low" | "medium" | "high";

const providerOrderByModelPrefix = {
  anthropic: ["anthropic", "vertex", "openai", "azure", "google"],
  google: ["google", "vertex", "openai", "azure", "anthropic"],
  openai: ["openai", "azure", "google", "anthropic", "vertex"],
} satisfies Record<string, string[]>;

type SupportedModelPrefix = keyof typeof providerOrderByModelPrefix;

type ProviderOptionsResult = {
  gateway: Pick<GatewayProviderOptions, "models" | "order" | "serviceTier">;
};

type ImageProviderOptionsResult = {
  gateway: Pick<GatewayProviderOptions, "models">;
  openai: { output_format: "webp"; quality: ImageGenerationQuality };
};

/**
 * Builds the gateway routing options used by our shared text-generation helper.
 * We keep this logic centralized so every task prefers the provider that matches
 * the primary model first, then uses the same cross-provider fallback order.
 */
function buildGatewayProviderOptions({
  fallbackModels,
  model,
  useFallback,
}: {
  fallbackModels: readonly string[];
  model: string;
  useFallback: boolean;
}): ProviderOptionsResult["gateway"] {
  const order = getGatewayProviderOrder(model);

  return { models: useFallback ? [...fallbackModels] : [], ...(order ? { order } : {}) };
}

/**
 * Returns the provider preference list for a gateway model string.
 * For example, `openai/*` should prefer OpenAI-backed credentials first,
 * while `google/*` should prefer Google-backed credentials first.
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
 * Builds the provider options shared by image-generation tasks.
 * Image requests do not use the text fallback helper, so they need their own
 * small wrapper to keep the OpenAI image output format in one place instead of
 * drifting across each task entry point.
 */
export function buildImageProviderOptions({
  fallbackModels,
  quality,
}: {
  fallbackModels: readonly string[];
  quality: ImageGenerationQuality;
}): ImageProviderOptionsResult {
  return { gateway: { models: [...fallbackModels] }, openai: { output_format: "webp", quality } };
}

/**
 * The gateway's service tiers. `priority` is for calls a learner is waiting on, such as a new
 * goal's first lesson: the same model answers about twice as fast (Sol: 130 to 177 tokens a second
 * instead of 66 to 99, 27 Sep 2026) at twice the price. `flex` is for background work nobody waits
 * on: best effort at about half the price on OpenAI and Google models, billed at the tier that
 * actually served it; Anthropic has no flex tier and answers at the standard one. No tier is the
 * standard one.
 */
export type ServiceTier = NonNullable<GatewayProviderOptions["serviceTier"]>;

/**
 * Builds the shared provider options object for text-generation tasks.
 * This exists so fallback models, gateway routing and the service tier stay consistent across
 * every task in this package.
 */
export function buildProviderOptions({
  model,
  serviceTier,
  useFallback,
  fallbackModels,
}: {
  model: string;
  serviceTier?: ServiceTier;
  useFallback: boolean;
  fallbackModels: readonly string[];
}): ProviderOptionsResult {
  const gateway = buildGatewayProviderOptions({ fallbackModels, model, useFallback });

  return { gateway: serviceTier ? { ...gateway, serviceTier } : gateway };
}
