import { type GatewayProviderOptions } from "@ai-sdk/gateway";
import { type LanguageModelCallOptions } from "ai";
import { getModelFamily } from "./_utils/model-family";

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

/** A bare id reasons like the model it backs up. */
export type FallbackModel =
  | string
  | { model: string; reasoning: Exclude<Reasoning, "provider-default"> };

/**
 * The gateway sends the call's `reasoning` to every model in a chain. A provider's own reasoning
 * option overrides it, but a provider without one takes another's (an `openai` effort reaches
 * Claude too), so a chain whose models reason differently names every provider's level.
 */
const reasoningOptionByProvider = {
  anthropic: (effort: Reasoning) => ({ effort }),
  openai: (reasoningEffort: Reasoning) => ({ reasoningEffort }),
};

type ReasoningProvider = keyof typeof reasoningOptionByProvider;

type ProviderOptionsResult = {
  gateway: Pick<GatewayProviderOptions, "models" | "order" | "serviceTier"> & {
    speed?: ServedSpeed;
  };
} & Partial<Record<ReasoningProvider, Record<string, Reasoning>>>;

type ImageProviderOptionsResult = {
  gateway: Pick<GatewayProviderOptions, "models">;
  openai: { background?: "transparent"; output_format: "webp"; quality: ImageGenerationQuality };
};

type ChainModel = { model: string; reasoning?: Reasoning };

function getChain({
  fallbackModels,
  model,
  reasoning,
  useFallback,
}: {
  fallbackModels: readonly FallbackModel[];
  model: string;
  reasoning?: Reasoning;
  useFallback: boolean;
}): [ChainModel, ...ChainModel[]] {
  const fallbacks = useFallback
    ? fallbackModels
        .map((entry) => (typeof entry === "string" ? { model: entry, reasoning } : entry))
        .filter((entry) => entry.model !== model)
    : [];

  return [{ model, reasoning }, ...fallbacks];
}

function isReasoningProvider(value: string): value is ReasoningProvider {
  return value in reasoningOptionByProvider;
}

function buildReasoningOptions(
  chain: readonly [ChainModel, ...ChainModel[]],
): Partial<Record<ReasoningProvider, Record<string, Reasoning>>> {
  const [main] = chain;

  if (chain.every((entry) => entry.reasoning === main.reasoning)) {
    return {};
  }

  const levels = new Map<ReasoningProvider, Reasoning>();

  for (const { model, reasoning } of chain) {
    const provider = getModelFamily(model);

    if (!isReasoningProvider(provider) || !reasoning || reasoning === "provider-default") {
      throw new Error(`The gateway can't set ${model}'s reasoning apart from its chain`);
    }

    if ((levels.get(provider) ?? reasoning) !== reasoning) {
      throw new Error(`The gateway gives every ${provider} model in a chain one reasoning level`);
    }

    levels.set(provider, reasoning);
  }

  return Object.fromEntries(
    [...levels].map(([provider, reasoning]) => [
      provider,
      reasoningOptionByProvider[provider](reasoning),
    ]),
  );
}

function getGatewayProviderOrder(model: string): GatewayProviderOptions["order"] {
  const modelPrefix = getModelFamily(model);

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
 * Every model in a chain gets the same sampling settings, so tasks leave them at the defaults:
 * Anthropic's models from Opus 4.7 and OpenAI's reasoning models drop them, and Google advises
 * against lowering Gemini 3's temperature. Pass the call's `reasoning` when a fallback names its
 * own.
 */
export function buildProviderOptions({
  model,
  reasoning,
  serviceTier,
  speed,
  useFallback,
  fallbackModels,
}: {
  model: string;
  reasoning?: Reasoning;
  serviceTier?: ServiceTier;
  speed?: ServedSpeed;
  useFallback: boolean;
  fallbackModels: readonly FallbackModel[];
}): ProviderOptionsResult {
  const chain = getChain({ fallbackModels, model, reasoning, useFallback });
  const [, ...fallbacks] = chain;
  const order = getGatewayProviderOrder(model);

  return {
    ...buildReasoningOptions(chain),
    gateway: {
      models: fallbacks.map((entry) => entry.model),
      ...(order ? { order } : {}),
      ...(serviceTier ? { serviceTier } : {}),
      ...(speed ? { speed } : {}),
    },
  };
}
