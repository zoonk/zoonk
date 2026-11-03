import "server-only";
import { LOCALE_COOKIE } from "@zoonk/utils/locale";
import { getLocaleFromRequest } from "@zoonk/utils/locale-request";
import { cookies, headers } from "next/headers";

/** Route handlers have no locale in their path, so they read the one the browser remembers or asks for. */
export async function getBrowserLocale() {
  const [store, headerStore] = await Promise.all([cookies(), headers()]);

  return getLocaleFromRequest({
    acceptLanguage: headerStore.get("accept-language"),
    cookieLocale: store.get(LOCALE_COOKIE)?.value,
  });
}
