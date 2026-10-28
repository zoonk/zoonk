import { countryToCurrency } from "@zoonk/utils/currency";
import { getCountryFromAcceptLanguage } from "@zoonk/utils/locale-request";

/** The proxy's pricing variant and the subscription page both read it, so both show the same price. */
export function getBillingCurrency(headers: Pick<Headers, "get">): string {
  const country =
    headers.get("x-vercel-ip-country") ??
    getCountryFromAcceptLanguage(headers.get("accept-language"));

  return countryToCurrency(country);
}
