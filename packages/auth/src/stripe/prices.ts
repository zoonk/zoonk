import { type PriceInfo } from "@zoonk/utils/currency";
import { getEnvironment } from "@zoonk/utils/environment";
import { stripeClient } from "./client";
import type Stripe from "stripe";

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
