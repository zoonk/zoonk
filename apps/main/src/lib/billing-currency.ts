import { countryToCurrency } from "@zoonk/utils/currency";
import { getCountryFromAcceptLanguage } from "@zoonk/utils/locale-request";

/**
 * The currency a request is billed in: its country's, from the platform's geo header, else the
 * region of the language the browser prefers. The proxy picks the pricing page's variant with it
 * and the subscription page reads it per request, so both show the same price.
 */
export function getBillingCurrency(headers: Pick<Headers, "get">): string {
  const country =
    headers.get("x-vercel-ip-country") ??
    getCountryFromAcceptLanguage(headers.get("accept-language"));

  return countryToCurrency(country);
}
