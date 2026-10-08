import fs from "node:fs/promises";
import { z } from "zod";

const GATEWAY_MODELS_URL = "https://ai-gateway.vercel.sh/v1/models";

/** The gateway lists prices as dollar strings per unit. */
const listedPriceSchema = z.coerce.number().nonnegative();

const listedTierSchema = z.object({
  cost: listedPriceSchema,
  max: z.number().optional(),
  min: z.number().optional(),
});

const listedRatesSchema = z.object({
  input: listedPriceSchema.optional(),
  input_cache_read: listedPriceSchema.optional(),
  input_cache_write: listedPriceSchema.optional(),
  output: listedPriceSchema.optional(),
});

const listedPricingSchema = listedRatesSchema.extend({
  image_dimension_quality_pricing: z
    .array(z.object({ cost: listedPriceSchema, size: z.string() }))
    .optional(),
  input_cache_read_tiers: z.array(listedTierSchema).optional(),
  input_cache_write_tiers: z.array(listedTierSchema).optional(),
  input_tiers: z.array(listedTierSchema).optional(),
  output_tiers: z.array(listedTierSchema).optional(),
  realtime_session_duration_cost_per_second: listedPriceSchema.optional(),
  service_tiers: z
    .object({ flex: listedRatesSchema.optional(), priority: listedRatesSchema.optional() })
    .optional(),
  speech_input_character_cost: listedPriceSchema.optional(),
  transcription_duration_cost_per_second: listedPriceSchema.optional(),
});

const gatewayModelsSchema = z.object({
  data: z.array(
    z.object({ id: z.string(), pricing: z.unknown().optional(), type: z.string().optional() }),
  ),
});

const priceTierSchema = z.object({
  cost: z.number(),
  max: z.number().optional(),
  min: z.number().optional(),
});

/** A service tier's token rates; a rate it doesn't list scales from the standard one. */
const tierRatesSchema = z.object({
  input: z.number(),
  inputCacheRead: z.number().optional(),
  inputCacheWrite: z.number().optional(),
  output: z.number(),
});

/**
 * Dollars per unit for one model. Token rates are per token, with long-context `*Tiers` picked by
 * the prompt's size; calls billed by length or count use `perSecond` (transcription, live voice),
 * `perCharacter` (speech) or `perImage`.
 */
const modelPricingSchema = z.object({
  input: z.number(),
  inputCacheRead: z.number().optional(),
  inputCacheReadTiers: z.array(priceTierSchema).optional(),
  inputCacheWrite: z.number().optional(),
  inputCacheWriteTiers: z.array(priceTierSchema).optional(),
  inputTiers: z.array(priceTierSchema).optional(),
  output: z.number(),
  outputTiers: z.array(priceTierSchema).optional(),
  perCharacter: z.number().optional(),
  perImage: z.number().optional(),
  /** Models that price each image by its size ("1K", "2K"): the price of each size. */
  perImageBySize: z.record(z.string(), z.number()).optional(),
  perSecond: z.number().optional(),
  serviceTiers: z
    .object({ flex: tierRatesSchema.optional(), priority: tierRatesSchema.optional() })
    .optional(),
});

export type ModelPricing = z.infer<typeof modelPricingSchema>;
export type PriceTier = z.infer<typeof priceTierSchema>;
export type TierRates = z.infer<typeof tierRatesSchema>;

export const gatewayPricesSchema = z.object({
  fetchedAt: z.string(),
  models: z.record(z.string(), modelPricingSchema),
  source: z.string(),
});

export type GatewayPrices = z.infer<typeof gatewayPricesSchema>;

type ListedRates = z.infer<typeof listedRatesSchema>;

/** A tier's rates, or nothing when the tier lists no input and output price. */
function toTierRates(rates: ListedRates | undefined): TierRates | undefined {
  return tierRatesSchema.safeParse({
    input: rates?.input,
    inputCacheRead: rates?.input_cache_read,
    inputCacheWrite: rates?.input_cache_write,
    output: rates?.output,
  }).data;
}

/** Each size's image price, for models that price sizes apart; undefined for a single price. */
function getImagePricesBySize(
  prices: { cost: number; size: string }[] | undefined,
): Record<string, number> | undefined {
  const sizes = (prices ?? []).filter((price) => price.size !== "default");

  return sizes.length > 1
    ? Object.fromEntries(sizes.map((price) => [price.size, price.cost]))
    : undefined;
}

/** The price of an image at the model's default size, for models that bill per image. */
function getDefaultImagePrice(
  prices: { cost: number; size: string }[] | undefined,
): number | undefined {
  return (prices?.find((price) => price.size === "default") ?? prices?.[0])?.cost;
}

/**
 * Keeps what a call's usage can be priced with. A model with no token, duration, character or
 * image price can't be priced and is left out, so its calls show up as unpriced instead of free.
 * Decision models (the gateway's `evaluation` type, such as `openai/gpt-6-luna-decisions`) list
 * only an input price: they write no tokens, so their output costs nothing.
 */
function toModelPricing({
  pricing,
  type,
}: {
  pricing?: unknown;
  type?: string;
}): ModelPricing | null {
  const parsed = listedPricingSchema.safeParse(pricing);

  if (!parsed.success) {
    return null;
  }

  const price = parsed.data;

  const perSecond =
    price.realtime_session_duration_cost_per_second ?? price.transcription_duration_cost_per_second;

  const perImage = getDefaultImagePrice(price.image_dimension_quality_pricing);
  const perCharacter = price.speech_input_character_cost;

  const hasTokenPrices =
    price.input !== undefined && (price.output !== undefined || type === "evaluation");

  if (!hasTokenPrices && perSecond === undefined && perImage === undefined) {
    return null;
  }

  return {
    input: price.input ?? 0,
    inputCacheRead: price.input_cache_read,
    inputCacheReadTiers: price.input_cache_read_tiers,
    inputCacheWrite: price.input_cache_write,
    inputCacheWriteTiers: price.input_cache_write_tiers,
    inputTiers: price.input_tiers,
    output: price.output ?? 0,
    outputTiers: price.output_tiers,
    perCharacter,
    perImage,
    perImageBySize: getImagePricesBySize(price.image_dimension_quality_pricing),
    perSecond,
    serviceTiers: price.service_tiers
      ? {
          flex: toTierRates(price.service_tiers.flex),
          priority: toTierRates(price.service_tiers.priority),
        }
      : undefined,
  };
}

/**
 * Downloads the gateway's public model list and saves its prices with a timestamp. The gateway
 * lists the providers' own prices, which is what our provider keys (BYOK) are billed at, so one
 * list prices both what runs in production and what evals compare. Run it when a model or a price
 * changes (`pnpm --filter @zoonk/ai prices:refresh`).
 */
export async function refreshGatewayPrices(file: URL): Promise<GatewayPrices> {
  const response = await fetch(GATEWAY_MODELS_URL);

  if (!response.ok) {
    throw new Error(`Gateway model list returned ${response.status}.`);
  }

  const { data } = gatewayModelsSchema.parse(await response.json());

  const models = Object.fromEntries(
    data.flatMap((model) => {
      const pricing = toModelPricing(model);
      return pricing ? [[model.id, pricing]] : [];
    }),
  );

  const prices: GatewayPrices = {
    fetchedAt: new Date().toISOString(),
    models,
    source: GATEWAY_MODELS_URL,
  };

  await fs.writeFile(file, `${JSON.stringify(prices, null, 2)}\n`);

  return prices;
}
