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

/**
 * The same model served faster at a higher price, for a call a learner is about to read; the
 * gateway reports the speed it served (`readGatewayMetadata`). `@ai-sdk/gateway` doesn't type it.
 */
export type ServedSpeed = "fast";

type ProviderOptionsResult = {
  gateway: Pick<GatewayProviderOptions, "models" | "order" | "serviceTier"> & {
    speed?: ServedSpeed;
  };
};

type ImageProviderOptionsResult = {
  gateway: Pick<GatewayProviderOptions, "models">;
  openai: { background?: "transparent"; output_format: "webp"; quality: ImageGenerationQuality };
};

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

function getGatewayProviderOrder(model: string): GatewayProviderOptions["order"] {
  const modelPrefix = model.split("/")[0] ?? "";

  if (!isSupportedModelPrefix(modelPrefix)) {
    return undefined;
  }

  return providerOrderByModelPrefix[modelPrefix];
}

function isSupportedModelPrefix(value: string): value is SupportedModelPrefix {
  return value in providerOrderByModelPrefix;
}

/**
 * The other no-training models fell short: MAI-Image-2.6-Flash misdraws lesson scenes, Seedream
 * misspells words, Muse rejects the `quality` option and Grok ignores `size`.
 */
const IMAGE_FALLBACK_MODELS = ["openai/gpt-image-2.5-sunburst", "microsoft/mai-image-2.6"] as const;

/**
 * These draw subjects OpenAI's models won't, but may train on prompts, so they only draw where
 * `allowsPromptTraining` allows it. Recraft refuses sizes outside its own list, such as 1024x1280.
 */
const TRAINING_IMAGE_FALLBACKS: readonly { model: string; sizes?: readonly string[] }[] = [
  { model: "bfl/flux-3-image" },
  { model: "recraft/recraft-v4.1-utility", sizes: ["1024x1024"] },
];

function getImageFallbackModels({
  promptTraining,
  size,
  useFallback,
}: {
  promptTraining: boolean;
  size: string;
  useFallback: boolean;
}): string[] {
  if (!useFallback) {
    return [];
  }

  const training = promptTraining
    ? TRAINING_IMAGE_FALLBACKS.filter(({ sizes }) => !sizes || sizes.includes(size))
    : [];

  return [...IMAGE_FALLBACK_MODELS, ...training.map(({ model }) => model)];
}

/** Evals turn `useFallback` off, so each image comes from the model under test. */
export function buildImageProviderOptions({
  background,
  promptTraining,
  quality,
  size,
  useFallback,
}: {
  background?: "transparent";
  promptTraining: boolean;
  quality: ImageGenerationQuality;
  size: string;
  useFallback: boolean;
}): ImageProviderOptionsResult {
  return {
    gateway: { models: getImageFallbackModels({ promptTraining, size, useFallback }) },
    openai: { ...(background ? { background } : {}), output_format: "webp", quality },
  };
}

/**
 * `flex` is best effort at about half the price; `priority` is faster at about twice. Only OpenAI
 * and Google models take a tier: a call that falls back to Anthropic answers at the standard one.
 */
export type ServiceTier = Extract<GatewayProviderOptions["serviceTier"], "flex" | "priority">;

/**
 * `bounded`: shared content very likely read again (an exam's or a language's, or a lesson other
 * goals already plan); `library`: shared content that may serve one learner; `personal`: one
 * learner's own.
 */
export type CallReuse = "bounded" | "library" | "personal";

/** `learner` while a learner watches a wait, `soon` within minutes, `later` in hours or days. */
export type CallWait = "learner" | "later" | "soon";

/**
 * A learner's wait gets `priority`; prepared-ahead work uses the standard tier, and background
 * work gets `flex`.
 */
export function chooseServiceTier({ wait }: { wait: CallWait }): ServiceTier | undefined {
  if (wait === "later") {
    return "flex";
  }

  if (wait === "learner") {
    return "priority";
  }

  return undefined;
}

/**
 * Every model in a chain gets the same settings, so tasks leave sampling settings at the defaults:
 * Anthropic's models from Opus 4.7 and OpenAI's reasoning models drop them, and Google advises
 * against lowering Gemini 3's temperature.
 */
export function buildProviderOptions({
  model,
  serviceTier,
  speed,
  useFallback,
  fallbackModels,
}: {
  model: string;
  serviceTier?: ServiceTier;
  speed?: ServedSpeed;
  useFallback: boolean;
  fallbackModels: readonly string[];
}): ProviderOptionsResult {
  const gateway = buildGatewayProviderOptions({ fallbackModels, model, useFallback });

  return {
    gateway: { ...gateway, ...(serviceTier ? { serviceTier } : {}), ...(speed ? { speed } : {}) },
  };
}
