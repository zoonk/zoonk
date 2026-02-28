import { type PriceInfo } from "@zoonk/utils/currency";
import { stripeClient } from "./client";
import type Stripe from "stripe";

function extractPrice(price: Stripe.Price, targetCurrency: string): [string, PriceInfo] | null {
  if (!price.lookup_key) {
    return null;
  }

  const currencyOption = price.currency_options?.[targetCurrency];

  if (currencyOption?.unit_amount !== undefined && currencyOption.unit_amount !== null) {
    return [price.lookup_key, { amount: currencyOption.unit_amount, currency: targetCurrency }];
  }

  if (price.unit_amount !== undefined && price.unit_amount !== null) {
    return [price.lookup_key, { amount: price.unit_amount, currency: price.currency }];
  }

  return null;
}

export async function getStripePrices(
  lookupKeys: string[],
  currency: string,
): Promise<Map<string, PriceInfo>> {
  if (lookupKeys.length === 0) {
    return new Map();
  }

  try {
    const prices = await stripeClient.prices.list({
      expand: ["data.currency_options"],
      lookup_keys: lookupKeys,
    });

    const entries = prices.data
      .map((price) => extractPrice(price, currency.toLowerCase()))
      .filter((entry): entry is [string, PriceInfo] => entry !== null);

    return new Map(entries);
  } catch {
    return new Map();
  }
}
