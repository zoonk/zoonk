import {
  type ModelPricing,
  type PriceTier,
  type TierRates,
  gatewayPricesSchema,
} from "./gateway-prices";
import gatewayPricesFile from "./gateway-prices.json";
import { PRICE_CHANGES, PRICE_OVERRIDES } from "./price-overrides";

/**
 * The single price list every AI call is priced with: the gateway's snapshot (`fetchedAt` says
 * when it was taken) plus the models the gateway doesn't list. Evals price their runs from it too.
 */
export const GATEWAY_PRICES = gatewayPricesSchema.parse(gatewayPricesFile);

const MODEL_PRICES: Readonly<Record<string, ModelPricing>> = {
  ...GATEWAY_PRICES.models,
  ...PRICE_OVERRIDES,
};

/** What a call used, in the units its model is billed by. */
export type CallUsage = {
  /** Every input token, cached reads and writes included, as the AI SDK counts them. */
  inputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  /** Every output token, reasoning included, as the AI SDK counts them. */
  outputTokens?: number;
  audioSeconds?: number;
  characters?: number;
  images?: number;
  /** The size the images were drawn at, for models that price sizes apart ("2K"). */
  imageSize?: string;
};

type ServiceTier = keyof NonNullable<ModelPricing["serviceTiers"]>;

/** The model's price on the day of the call: the latest announced change from that day on. */
function getModelPricing({ at, model }: { at: Date; model: string }): ModelPricing | undefined {
  const change = PRICE_CHANGES.filter(
    (entry) => entry.model === model && new Date(entry.from).getTime() <= at.getTime(),
  ).toSorted((a, b) => new Date(b.from).getTime() - new Date(a.from).getTime())[0];

  return change?.pricing ?? MODEL_PRICES[model];
}

/** Long-context tiers switch on the prompt's size, so every rate of a call is picked by it. */
function getRate({
  base,
  inputTokens,
  tiers,
}: {
  base: number;
  inputTokens: number;
  tiers?: PriceTier[];
}): number {
  const tier = tiers?.find(
    (item) => inputTokens >= (item.min ?? 0) && (item.max === undefined || inputTokens < item.max),
  );

  return tier?.cost ?? base;
}

function isServiceTier(value: string | undefined): value is ServiceTier {
  return value === "flex" || value === "priority";
}

/**
 * A flex or priority call is billed at that tier's rates. A rate the tier doesn't list (a cache
 * write, a long-context tier) scales from the standard one by the tier's input ratio, the way
 * providers price their tiers.
 */
function getTierScale({ pricing, serviceTier }: { pricing: ModelPricing; serviceTier?: string }): {
  rates: Partial<TierRates>;
  scale: number;
} {
  const tier = isServiceTier(serviceTier) ? pricing.serviceTiers?.[serviceTier] : undefined;

  if (!tier || pricing.input === 0) {
    return { rates: {}, scale: 1 };
  }

  return { rates: tier, scale: tier.input / pricing.input };
}

function priceTokens({
  pricing,
  serviceTier,
  usage,
}: {
  pricing: ModelPricing;
  serviceTier?: string;
  usage: CallUsage;
}): number {
  const inputTokens = usage.inputTokens ?? 0;
  const cacheReadTokens = usage.cacheReadTokens ?? 0;
  const cacheWriteTokens = usage.cacheWriteTokens ?? 0;
  const uncachedTokens = Math.max(0, inputTokens - cacheReadTokens - cacheWriteTokens);
  const { rates, scale } = getTierScale({ pricing, serviceTier });

  const rate = (
    base: number,
    tiers: PriceTier[] | undefined,
    tierRate: number | undefined,
  ): number => tierRate ?? getRate({ base, inputTokens, tiers }) * scale;

  const inputRate = rate(pricing.input, pricing.inputTiers, rates.input);

  const cacheReadRate = rate(
    pricing.inputCacheRead ?? pricing.input,
    pricing.inputCacheReadTiers,
    rates.inputCacheRead,
  );

  const cacheWriteRate = rate(
    pricing.inputCacheWrite ?? pricing.input,
    pricing.inputCacheWriteTiers,
    rates.inputCacheWrite,
  );

  const outputRate = rate(pricing.output, pricing.outputTiers, rates.output);

  return (
    uncachedTokens * inputRate +
    cacheReadTokens * cacheReadRate +
    cacheWriteTokens * cacheWriteRate +
    (usage.outputTokens ?? 0) * outputRate
  );
}

/** An image's price at the size it was drawn, or the model's single price. */
function getImagePrice({ pricing, size }: { pricing: ModelPricing; size?: string }): number {
  const sized = size === undefined ? undefined : pricing.perImageBySize?.[size];
  return sized ?? pricing.perImage ?? 0;
}

/** Calls billed by length or count: seconds of audio, characters read aloud, images drawn. */
function priceUnits({ pricing, usage }: { pricing: ModelPricing; usage: CallUsage }): number {
  return (
    (usage.audioSeconds ?? 0) * (pricing.perSecond ?? 0) +
    (usage.characters ?? 0) * (pricing.perCharacter ?? 0) +
    (usage.images ?? 0) * getImagePrice({ pricing, size: usage.imageSize })
  );
}

/**
 * What one call cost in dollars at these prices: input split into uncached, cached reads and
 * cache writes, output with its reasoning (the AI SDK counts reasoning inside output tokens, so
 * it isn't added twice), at the tier that served it, plus any length- or count-based charge.
 */
export function priceCall({
  pricing,
  serviceTier,
  usage,
}: {
  pricing: ModelPricing;
  serviceTier?: string;
  usage: CallUsage;
}): number {
  return priceTokens({ pricing, serviceTier, usage }) + priceUnits({ pricing, usage });
}

/**
 * What one call cost in dollars at the provider's list price, which is what our own provider keys
 * (BYOK) are billed (`priceCall`). Undefined when the model has no price, so an unknown model
 * never looks free.
 */
export function computeCallCostUsd({
  at = new Date(),
  model,
  serviceTier,
  usage,
}: {
  /** When the call ran, for prices that change on a set day; now by default. */
  at?: Date;
  model: string;
  serviceTier?: string;
  usage: CallUsage;
}): number | undefined {
  const pricing = getModelPricing({ at, model });
  return pricing ? priceCall({ pricing, serviceTier, usage }) : undefined;
}
