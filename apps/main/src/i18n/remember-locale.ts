import { LOCALE_COOKIE, type SupportedLocale } from "@zoonk/utils/locale";
import { LOCALE_COOKIE_MAX_AGE } from "./routing";

/** Only a language switch saves it, in the browser: pages are static, and a link shared in another language mustn't change it. */
export function rememberLocale(locale: SupportedLocale): void {
  // oxlint-disable-next-line unicorn/no-document-cookie -- synchronous, so it's saved before the switch's navigation starts.
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
}
