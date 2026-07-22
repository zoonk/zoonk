import { type PriceInfo } from "@zoonk/utils/currency";
import { getEnvironment } from "@zoonk/utils/environment";
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

/**
 * Loads public prices from Stripe while keeping E2E runs isolated from the
 * external provider. E2E uses a deliberately invalid key and already renders
 * the same price-unavailable state represented by an empty result.
 */
export async function getStripePrices(
  lookupKeys: string[],
  currency: string,
): Promise<Map<string, PriceInfo>> {
  if (lookupKeys.length === 0 || getEnvironment() === "e2e") {
    return new Map();
  }

  const prices = await stripeClient.prices.list({
    expand: ["data.currency_options"],
    lookup_keys: lookupKeys,
  });

  const entries = prices.data.flatMap((price) => {
    const entry = extractPrice(price, currency.toLowerCase());
    return entry ? [entry] : [];
  });

  return new Map(entries);
}
