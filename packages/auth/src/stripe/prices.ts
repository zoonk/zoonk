import { type PriceInfo } from "@zoonk/utils/currency";
import { getEnvironment } from "@zoonk/utils/environment";
import { stripeClient } from "./client";
import type Stripe from "stripe";

/** A price in `targetCurrency` when Stripe has that currency's option, else in the price's own. */
function extractPrice(price: Stripe.Price, targetCurrency: string): PriceInfo | null {
  const currencyOption = price.currency_options?.[targetCurrency];

  if (currencyOption?.unit_amount !== undefined && currencyOption.unit_amount !== null) {
    return { amount: currencyOption.unit_amount, currency: targetCurrency };
  }

  if (price.unit_amount !== undefined && price.unit_amount !== null) {
    return { amount: price.unit_amount, currency: price.currency };
  }

  return null;
}

/** Each lookup key's price in each currency (lowercase), from one Stripe request. */
export type StripePriceTable = Record<string, Record<string, PriceInfo>>;

function getPricesByCurrency(price: Stripe.Price, currencies: readonly string[]) {
  return Object.fromEntries(
    currencies.flatMap((currency) => {
      const target = currency.toLowerCase();
      const info = extractPrice(price, target);
      return info ? [[target, info]] : [];
    }),
  );
}

/**
 * Loads public prices from Stripe in every currency asked for, in one request, while keeping E2E
 * runs isolated from the external provider. E2E uses a deliberately invalid key and already
 * renders the same price-unavailable state represented by an empty result.
 */
export async function getStripePriceTable(
  lookupKeys: string[],
  currencies: readonly string[],
): Promise<StripePriceTable> {
  if (lookupKeys.length === 0 || getEnvironment() === "e2e") {
    return {};
  }

  const prices = await stripeClient.prices.list({
    expand: ["data.currency_options"],
    lookup_keys: lookupKeys,
  });

  return Object.fromEntries(
    prices.data.flatMap((price) =>
      price.lookup_key ? [[price.lookup_key, getPricesByCurrency(price, currencies)]] : [],
    ),
  );
}

/** Public prices from Stripe in one currency, by lookup key. */
export async function getStripePrices(
  lookupKeys: string[],
  currency: string,
): Promise<Map<string, PriceInfo>> {
  const table = await getStripePriceTable(lookupKeys, [currency]);
  const target = currency.toLowerCase();

  return new Map(
    Object.entries(table).flatMap(([lookupKey, byCurrency]) => {
      const info = byCurrency[target];
      return info ? [[lookupKey, info] as const] : [];
    }),
  );
}
