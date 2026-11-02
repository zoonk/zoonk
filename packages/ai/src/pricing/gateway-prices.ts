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

const listedImagePriceSchema = z.object({
  cost: listedPriceSchema,
  quality: z.string().optional(),
  size: z.string().optional(),
  style: z.string().optional(),
});

type ListedImagePrice = z.infer<typeof listedImagePriceSchema>;

const listedPricingSchema = listedRatesSchema.extend({
  image: listedPriceSchema.optional(),
  image_dimension_quality_pricing: z.array(listedImagePriceSchema).optional(),
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

const tierRatesSchema = z.object({
  input: z.number(),
  inputCacheRead: z.number().optional(),
  inputCacheWrite: z.number().optional(),
  output: z.number(),
});

/**
 * Dollars per unit: token rates per token, `perSecond` for transcription and live voice, and
 * `perCharacter` for speech.
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

function toTierRates(rates: ListedRates | undefined): TierRates | undefined {
  return tierRatesSchema.safeParse({
    input: rates?.input,
    inputCacheRead: rates?.input_cache_read,
    inputCacheWrite: rates?.input_cache_write,
    output: rates?.output,
  }).data;
}

function getSizePrices(prices: ListedImagePrice[] | undefined): { cost: number; size: string }[] {
  return (prices ?? []).flatMap(({ cost, quality, size, style }) =>
    size && !quality && !style ? [{ cost, size }] : [],
  );
}

function getImagePricesBySize(
  prices: ListedImagePrice[] | undefined,
): Record<string, number> | undefined {
  const sizes = getSizePrices(prices).filter((price) => price.size !== "default");

  return sizes.length > 1
    ? Object.fromEntries(sizes.map((price) => [price.size, price.cost]))
    : undefined;
}

function getDefaultImagePrice({
  image,
  prices,
}: {
  image?: number;
  prices?: ListedImagePrice[];
}): number | undefined {
  const sizes = getSizePrices(prices);
  return image ?? (sizes.find((price) => price.size === "default") ?? sizes[0])?.cost;
}

/**
 * A model with no price is left out, so its calls show up as unpriced instead of free. Decision
 * models list only an input price: they write no tokens.
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

  const perImage = getDefaultImagePrice({
    image: price.image,
    prices: price.image_dimension_quality_pricing,
  });

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

/** The gateway lists the providers' own prices, which our provider keys (BYOK) are billed at. */
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
