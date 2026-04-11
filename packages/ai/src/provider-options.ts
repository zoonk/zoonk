import { type GatewayProviderOptions } from "@ai-sdk/gateway";
import { type OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";

export type ReasoningEffort = "auto" | "low" | "medium" | "high";

const providerOrderByModelPrefix = {
  anthropic: ["anthropic", "vertex", "openai", "azure", "google"],
  google: ["google", "vertex", "openai", "azure", "anthropic"],
  openai: ["openai", "azure", "google", "anthropic", "vertex"],
} satisfies Record<string, string[]>;

type SupportedModelPrefix = keyof typeof providerOrderByModelPrefix;

type ProviderOptionsResult = {
  gateway: Pick<GatewayProviderOptions, "models" | "order">;
  openai?: Pick<OpenAILanguageModelResponsesOptions, "reasoningEffort">;
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
  fallbackModels: string[];
  model: string;
  useFallback: boolean;
}): ProviderOptionsResult["gateway"] {
  const order = getGatewayProviderOrder(model);

  return {
    models: useFallback ? fallbackModels : [],
    ...(order ? { order } : {}),
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
 * Builds the shared provider options object for text-generation tasks.
 * This exists so fallback models, gateway routing, and provider-specific
 * reasoning settings stay consistent across every task in this package.
 */
export function buildProviderOptions({
  model,
  useFallback,
  fallbackModels,
  reasoningEffort,
}: {
  model: string;
  useFallback: boolean;
  fallbackModels: string[];
  reasoningEffort?: ReasoningEffort;
}): ProviderOptionsResult {
  const options: ProviderOptionsResult = {
    gateway: buildGatewayProviderOptions({ fallbackModels, model, useFallback }),
  };

  if (reasoningEffort && reasoningEffort !== "auto") {
    options.openai = { reasoningEffort };
  }

  return options;
}
