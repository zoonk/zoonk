import { VISITOR_COUNTRY_COOKIE } from "@/lib/visitor-country";
import { BILLING_CURRENCIES, COUNTRY_CURRENCY, DEFAULT_CURRENCY } from "@zoonk/utils/currency";

/** The attribute a scope's currency is on. */
const BILLING_CURRENCY_ATTRIBUTE = "data-billing-currency";

/**
 * Shows each price in the scope's currency only: of a price's versions, each naming the currencies
 * it's for (`data-currency`, see `CurrencyVariants`), the one naming the scope's currency.
 */
export const BILLING_CURRENCY_CSS = BILLING_CURRENCIES.map(
  (currency) =>
    `[${BILLING_CURRENCY_ATTRIBUTE}="${currency}"] [data-currency]:not([data-currency~="${currency}"]){display:none}`,
).join("");

/**
 * Picks the scope's currency from the visitor's country cookie as the page loads, before its
 * prices are drawn: the static HTML can't know the reader's country, and showing another currency
 * until scripts load would show a wrong price. It runs inside the scope, as its first child, and
 * reads the same map as `countryToCurrency`.
 */
export const BILLING_CURRENCY_SCRIPT = `(function(s){var m=document.cookie.match(/(?:^|;\\s*)${VISITOR_COUNTRY_COOKIE}=([^;]*)/),c=m&&${JSON.stringify(COUNTRY_CURRENCY)}[decodeURIComponent(m[1]).toUpperCase()];s.parentNode.setAttribute("${BILLING_CURRENCY_ATTRIBUTE}",c||"${DEFAULT_CURRENCY}")})(document.currentScript)`;
