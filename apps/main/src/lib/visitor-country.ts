import { readCookie } from "@zoonk/utils/cookies";

/**
 * The visitor's country (ISO 3166-1 alpha-2) as the proxy last saw it: the platform's geo header,
 * else the region of the language the browser prefers. The proxy keeps it in a cookie the browser
 * reads, so pages that depend on it (the pricing page's currency) stay static and pick in the
 * browser.
 */
export const VISITOR_COUNTRY_COOKIE = "zoonk-country";

/** The visitor's country in the browser; null without the cookie. */
export function readVisitorCountry(): string | null {
  return readCookie(VISITOR_COUNTRY_COOKIE);
}
