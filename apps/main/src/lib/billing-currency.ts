import { countryToCurrency } from "@zoonk/utils/currency";
import { getRequestCountry } from "@zoonk/utils/locale-request";

/** The proxy's pricing variant and the subscription page both read it, so both show the same price. */
export function getBillingCurrency(headers: Pick<Headers, "get">): string {
  return countryToCurrency(getRequestCountry(headers));
}
