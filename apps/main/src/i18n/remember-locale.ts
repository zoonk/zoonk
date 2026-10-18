import { LOCALE_COOKIE, type SupportedLocale } from "@zoonk/utils/locale";
import { LOCALE_COOKIE_MAX_AGE } from "./routing";

/**
 * Saves the language a learner picks in a language switch, which the proxy opens the site's
 * unprefixed addresses in from then on. Only a pick saves it, in the browser: no page's response
 * sets it, since pages are static and a link shared in another language mustn't change it. The
 * cookie is written at once, before the switch's navigation leaves the page.
 */
export function rememberLocale(locale: SupportedLocale): void {
  // oxlint-disable-next-line unicorn/no-document-cookie -- synchronous, so it's saved before the switch's navigation starts.
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
}
