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

type ProviderOptionsResult = { gateway: Pick<GatewayProviderOptions, "models" | "order"> };

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
 * Builds the provider options shared by text-generation tasks.
 * Reasoning is intentionally passed directly to `generateText`, because SDK 7
 * exposes it as a top-level option rather than a provider-specific setting.
 */
export function buildProviderOptions({
  model,
  useFallback,
  fallbackModels,
}: {
  model: string;
  useFallback: boolean;
  fallbackModels: readonly string[];
}): ProviderOptionsResult {
  return { gateway: buildGatewayProviderOptions({ fallbackModels, model, useFallback }) };
}
