import { type PriceInfo } from "@zoonk/utils/currency";
import { stripeClient } from "./client";
import type Stripe from "stripe";

export type { PriceInfo } from "@zoonk/utils/currency";

function extractPrice(
  price: Stripe.Price,
  targetCurrency: string,
): { key: string; info: PriceInfo } | null {
  if (!price.lookup_key) {
    return null;
  }

  const currencyOption = price.currency_options?.[targetCurrency];

  if (currencyOption?.unit_amount !== undefined && currencyOption.unit_amount !== null) {
    return {
      info: { amount: currencyOption.unit_amount, currency: targetCurrency },
      key: price.lookup_key,
    };
  }

  if (price.unit_amount !== undefined && price.unit_amount !== null) {
    return {
      info: { amount: price.unit_amount, currency: price.currency },
      key: price.lookup_key,
    };
  }

  return null;
}

export async function getStripePrices(
  lookupKeys: string[],
  currency: string,
): Promise<Map<string, PriceInfo>> {
  const result = new Map<string, PriceInfo>();

  if (lookupKeys.length === 0) {
    return result;
  }

  const prices = await stripeClient.prices.list({
    expand: ["data.currency_options"],
    lookup_keys: lookupKeys,
  });

  const targetCurrency = currency.toLowerCase();

  for (const price of prices.data) {
    const extracted = extractPrice(price, targetCurrency);

    if (extracted) {
      result.set(extracted.key, extracted.info);
    }
  }

  return result;
}
