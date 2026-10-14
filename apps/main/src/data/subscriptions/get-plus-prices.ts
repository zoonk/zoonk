import "server-only";
import { type StripePriceTable, getStripePriceTable } from "@zoonk/auth/stripe-prices";
import { BILLING_CURRENCIES, type PriceInfo } from "@zoonk/utils/currency";
import { safeAsync } from "@zoonk/utils/error";
import { PLUS_PLAN } from "@zoonk/utils/subscription";
import { cacheLife } from "next/cache";

/**
 * Plus's prices in every currency a country is billed in, from one Stripe read shared by every
 * reader and worked out again every hour, so the pricing page's currency variants stay static.
 * Provider errors escape, so an outage is never kept as an empty table.
 */
async function getCachedPlusPriceTable(): Promise<StripePriceTable> {
  "use cache";
  cacheLife("hours");

  return getStripePriceTable([PLUS_PLAN.lookupKey, PLUS_PLAN.annualLookupKey], BILLING_CURRENCIES);
}

/**
 * Read only when Stripe was unavailable. A static page lasts as long as the shortest cache it read,
 * so the pricing page that rendered without prices is worked out again on its first visit after a
 * minute, instead of keeping no prices for the hour real ones would last.
 */
async function retryPricesSoon(): Promise<void> {
  "use cache";
  cacheLife("minutes");
}

/**
 * Plus's monthly and yearly prices in `currency`, read from Stripe so no page writes a price down.
 * A missing price comes back as null; so does every price while Stripe is unavailable (checkout
 * then shows them), and that fallback lives outside the cache, so a later render reads it again.
 */
export async function getPlusPrices(
  currency: string,
): Promise<{ monthlyPrice: PriceInfo | null; yearlyPrice: PriceInfo | null }> {
  const { data, error } = await safeAsync(() => getCachedPlusPriceTable());

  if (error) {
    await retryPricesSoon();
  }

  return {
    monthlyPrice: data?.[PLUS_PLAN.lookupKey]?.[currency] ?? null,
    yearlyPrice: data?.[PLUS_PLAN.annualLookupKey]?.[currency] ?? null,
  };
}
