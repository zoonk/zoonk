import "server-only";
import { getStripePriceTable } from "@zoonk/auth/stripe-prices";
import { BILLING_CURRENCIES, type PriceInfo } from "@zoonk/utils/currency";
import { safeAsync } from "@zoonk/utils/error";
import { PLUS_PLAN } from "@zoonk/utils/subscription";
import { cacheLife } from "next/cache";

/** A plan's price in every billing currency (some may be billed in another, as Stripe falls back). */
type CurrencyPrices = Readonly<Record<string, PriceInfo>>;

/**
 * Plus's monthly and yearly prices in every currency a country is billed in. A plan has a price in
 * every currency or none, so the page's shape doesn't depend on which currency the reader sees.
 */
export type PlusPriceTable = { monthly: CurrencyPrices | null; yearly: CurrencyPrices | null };

const NO_PRICES: PlusPriceTable = { monthly: null, yearly: null };

function inEveryCurrency(prices: CurrencyPrices | undefined): CurrencyPrices | null {
  return prices && BILLING_CURRENCIES.every((currency) => prices[currency]) ? prices : null;
}

/**
 * One Stripe read for every currency, shared by every reader and worked out again every hour, so
 * pages showing prices stay static and the reader's currency is picked in the browser. Provider
 * errors escape, so an outage is never kept as an empty table.
 */
async function getCachedPlusPriceTable(): Promise<PlusPriceTable> {
  "use cache";
  cacheLife("hours");

  const table = await getStripePriceTable(
    [PLUS_PLAN.lookupKey, PLUS_PLAN.annualLookupKey],
    BILLING_CURRENCIES,
  );

  return {
    monthly: inEveryCurrency(table[PLUS_PLAN.lookupKey]),
    yearly: inEveryCurrency(table[PLUS_PLAN.annualLookupKey]),
  };
}

/**
 * The pages can still explain Plus and start checkout when Stripe is unavailable: without prices,
 * checkout shows them. The fallback lives outside the cache, so a later render reads Stripe again.
 */
export async function getPlusPriceTable(): Promise<PlusPriceTable> {
  const { data } = await safeAsync(() => getCachedPlusPriceTable());
  return data ?? NO_PRICES;
}
