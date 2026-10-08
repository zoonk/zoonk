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
 * The gateway's service tiers we ask for, always through `chooseServiceTier`. `flex` is best
 * effort at about half the price; `priority` is served faster at about twice the price. Both apply
 * to OpenAI and Google models only, billed at the tier that actually served the call: Anthropic
 * has no tier through the gateway, and its fast mode runs on the gateway's own credentials rather
 * than our Anthropic key, so a call that falls back to an Anthropic model answers at the standard
 * tier. Unset is the standard tier.
 */
export type ServiceTier = Extract<GatewayProviderOptions["serviceTier"], "flex" | "priority">;

/**
 * Who uses what a call writes: `bounded` for shared content very likely read again, of goals with
 * a limited set of courses (an exam's notice, its graph, outlines, lessons and item bank; a
 * language course's) or a lesson other learners' goals already plan (a popular shared course's),
 * `library` for shared content on any topic, which may serve one learner only (a niche goal's),
 * and `personal` for one learner's own. It sets a call's service tier and a lesson's reviewer
 * (`getLessonCheckModels`).
 */
export type CallReuse = "bounded" | "library" | "personal";

/**
 * When a call's result is needed: `learner` while a learner watches a wait, `soon` within the
 * next minutes (the lesson after the one being studied) and `later` in hours or days.
 */
export type CallWait = "learner" | "later" | "soon";

/**
 * The single rule for every call's service tier. Work nobody needs for hours runs at `flex`.
 * A learner waiting gets `priority` when what's written is very likely reused (its premium is
 * paid once for many learners) or when the call is `small`: a one-off wait whose doubled price is
 * a fraction of a cent, such as understanding a goal as it's typed. Everything else runs at the
 * standard tier, including interactive calls that repeat all session long (grading, explanations,
 * the buddy), which never set `small`: their premium would add up per learner.
 */
export function chooseServiceTier({
  reuse = "library",
  small = false,
  wait,
}: {
  /** Only a learner's wait reads it; unset is `library`. */
  reuse?: CallReuse;
  small?: boolean;
  wait: CallWait;
}): ServiceTier | undefined {
  if (wait === "later") {
    return "flex";
  }

  if (wait === "learner" && (reuse === "bounded" || small)) {
    return "priority";
  }

  return undefined;
}

/**
 * Builds the shared provider options object for text-generation tasks.
 * This exists so fallback models, gateway routing and the service tier stay consistent across
 * every task in this package. Every model in a chain gets the same call settings, so tasks leave
 * sampling settings (`temperature`, `topP`, `topK`) at the models' defaults: Anthropic's models
 * from Opus 4.7 and OpenAI's reasoning models drop them, and Google advises against lowering
 * Gemini 3's temperature, which can make it loop or reason worse.
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
