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
 * Plus's monthly and yearly prices in `currency`, read from Stripe so no page writes a price down.
 * A missing price comes back as null; so does every price while Stripe is unavailable (checkout
 * then shows them), and that fallback lives outside the cache, so a later render reads it again.
 */
export async function getPlusPrices(
  currency: string,
): Promise<{ monthlyPrice: PriceInfo | null; yearlyPrice: PriceInfo | null }> {
  const { data } = await safeAsync(() => getCachedPlusPriceTable());

  return {
    monthlyPrice: data?.[PLUS_PLAN.lookupKey]?.[currency] ?? null,
    yearlyPrice: data?.[PLUS_PLAN.annualLookupKey]?.[currency] ?? null,
  };
}
