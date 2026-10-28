import "server-only";
import { type StripePriceTable, getStripePriceTable } from "@zoonk/auth/stripe-prices";
import { BILLING_CURRENCIES, type PriceInfo } from "@zoonk/utils/currency";
import { safeAsync } from "@zoonk/utils/error";
import { PLUS_PLAN } from "@zoonk/utils/subscription";

/** Provider errors escape, so an outage is never cached as an empty table. */
async function getCachedPlusPriceTable(): Promise<StripePriceTable> {
  "use cache";

  return getStripePriceTable([PLUS_PLAN.lookupKey, PLUS_PLAN.annualLookupKey], BILLING_CURRENCIES);
}

/** Null while Stripe is unavailable; that fallback lives outside the cache, so a later render reads it again. */
export async function getPlusPrices(
  currency: string,
): Promise<{ monthlyPrice: PriceInfo | null; yearlyPrice: PriceInfo | null }> {
  const { data } = await safeAsync(() => getCachedPlusPriceTable());

  return {
    monthlyPrice: data?.[PLUS_PLAN.lookupKey]?.[currency] ?? null,
    yearlyPrice: data?.[PLUS_PLAN.annualLookupKey]?.[currency] ?? null,
  };
}
