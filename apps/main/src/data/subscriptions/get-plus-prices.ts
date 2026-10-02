import "server-only";
import { countryToCurrency } from "@zoonk/utils/currency";
import { PLUS_PLAN } from "@zoonk/utils/subscription";
import { getBillingCountryCode } from "./get-billing-country-code";
import { getStripePrices } from "./get-stripe-prices";

/**
 * Plus's monthly and yearly prices in the viewer's currency, read from Stripe so no page writes a
 * price down. Country detection is private request data, but Stripe prices are public, so the
 * price read itself stays cached across viewers. A missing price comes back as null.
 */
export async function getPlusPrices() {
  const countryCode = await getBillingCountryCode();

  const priceMap = await getStripePrices({
    currency: countryToCurrency(countryCode),
    lookupKeys: [PLUS_PLAN.lookupKey, PLUS_PLAN.annualLookupKey],
  });

  return {
    monthlyPrice: priceMap.get(PLUS_PLAN.lookupKey) ?? null,
    yearlyPrice: priceMap.get(PLUS_PLAN.annualLookupKey) ?? null,
  };
}
