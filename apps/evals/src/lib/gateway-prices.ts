import fs from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import z from "zod";

const GATEWAY_MODELS_URL = "https://ai-gateway.vercel.sh/v1/models";
const PRICES_FILE = path.join(process.cwd(), "data", "gateway-prices.json");

/** The gateway lists prices as dollar strings per token. */
const priceSchema = z.coerce.number().nonnegative();

const tierSchema = z.object({
  cost: priceSchema,
  max: z.number().optional(),
  min: z.number().optional(),
});

const gatewayPricingSchema = z.object({
  input: priceSchema,
  input_cache_read: priceSchema.optional(),
  input_cache_read_tiers: z.array(tierSchema).optional(),
  input_cache_write: priceSchema.optional(),
  input_cache_write_tiers: z.array(tierSchema).optional(),
  input_tiers: z.array(tierSchema).optional(),
  output: priceSchema,
  output_tiers: z.array(tierSchema).optional(),
});

const gatewayModelsSchema = z.object({
  data: z.array(
    z.object({ id: z.string(), pricing: z.unknown().optional(), type: z.string().optional() }),
  ),
});

export type PriceTier = z.infer<typeof tierSchema>;

/** Dollars per token, as listed by the gateway. */
export type ModelPricing = {
  input: number;
  output: number;
  inputCacheRead?: number;
  inputCacheWrite?: number;
  inputTiers?: PriceTier[];
  outputTiers?: PriceTier[];
  inputCacheReadTiers?: PriceTier[];
  inputCacheWriteTiers?: PriceTier[];
};

const pricesFileSchema = z.object({
  fetchedAt: z.string(),
  models: z.record(
    z.string(),
    z.object({
      input: z.number(),
      inputCacheRead: z.number().optional(),
      inputCacheReadTiers: z.array(tierSchema).optional(),
      inputCacheWrite: z.number().optional(),
      inputCacheWriteTiers: z.array(tierSchema).optional(),
      inputTiers: z.array(tierSchema).optional(),
      output: z.number(),
      outputTiers: z.array(tierSchema).optional(),
    }),
  ),
  source: z.string(),
});

export type GatewayPrices = z.infer<typeof pricesFileSchema>;

/**
 * Keeps only token prices. Image, video, speech and search prices use other
 * units, and models without input and output prices can't be scored for cost.
 */
function toModelPricing(pricing: unknown): ModelPricing | null {
  const parsed = gatewayPricingSchema.safeParse(pricing);

  if (!parsed.success) {
    return null;
  }

  const price = parsed.data;

  return {
    input: price.input,
    inputCacheRead: price.input_cache_read,
    inputCacheReadTiers: price.input_cache_read_tiers,
    inputCacheWrite: price.input_cache_write,
    inputCacheWriteTiers: price.input_cache_write_tiers,
    inputTiers: price.input_tiers,
    output: price.output,
    outputTiers: price.output_tiers,
  };
}

/**
 * Downloads the gateway's public model list and saves its token prices with a
 * timestamp. Run it when a model or price changes (`pnpm prices:refresh`), so
 * evals price runs from the same list the gateway bills from.
 */
export async function refreshGatewayPrices(): Promise<GatewayPrices> {
  const response = await fetch(GATEWAY_MODELS_URL);

  if (!response.ok) {
    throw new Error(`Gateway model list returned ${response.status}.`);
  }

  const { data } = gatewayModelsSchema.parse(await response.json());

  const models = Object.fromEntries(
    data.flatMap((model) => {
      const pricing = toModelPricing(model.pricing);
      return pricing ? [[model.id, pricing]] : [];
    }),
  );

  const prices: GatewayPrices = {
    fetchedAt: new Date().toISOString(),
    models,
    source: GATEWAY_MODELS_URL,
  };

  await fs.mkdir(path.dirname(PRICES_FILE), { recursive: true });
  await fs.writeFile(PRICES_FILE, `${JSON.stringify(prices, null, 2)}\n`);

  return prices;
}

/**
 * Reads the saved price list, downloading it only when the file is missing.
 * The saved file is the offline copy, so a run never depends on the network
 * just to show costs.
 */
export const loadGatewayPrices = cache(async (): Promise<GatewayPrices> => {
  const saved = await fs.readFile(PRICES_FILE, "utf8").catch(() => null);

  if (!saved) {
    return refreshGatewayPrices();
  }

  return pricesFileSchema.parse(JSON.parse(saved));
});
