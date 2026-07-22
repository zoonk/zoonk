import { getStripePrices as queryStripePrices } from "@zoonk/core/auth/stripe-prices";
import { type PriceInfo } from "@zoonk/utils/currency";
import { safeAsync } from "@zoonk/utils/error";

export type StripePriceMap = Map<string, PriceInfo>;

/**
 * Reuses successful public Stripe price data across visitors. Provider errors
 * must escape this boundary so a temporary outage cannot become a cached empty
 * price response.
 */
async function getCachedStripePrices({
  currency,
  lookupKeys,
}: {
  currency: string;
  lookupKeys: string[];
}) {
  "use cache";

  return queryStripePrices(lookupKeys, currency);
}

/**
 * The subscription page can still explain Plus and start checkout when Stripe
 * pricing is temporarily unavailable. This fallback lives outside the cached
 * function, so every later request can retry Stripe instead of reusing an empty
 * result created by a provider failure.
 */
export async function getStripePrices({
  currency,
  lookupKeys,
}: {
  currency: string;
  lookupKeys: string[];
}): Promise<StripePriceMap> {
  const { data } = await safeAsync(() => getCachedStripePrices({ currency, lookupKeys }));
  return data ?? new Map();
}
