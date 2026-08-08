import { LOCALE_COOKIE, getLocaleFromRequest } from "@zoonk/utils/locale";
import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { AUTH_LOCALE_HEADER } from "./auth-locale";

export default getRequestConfig(async ({ locale: overrideLocale }) => {
  const store = await cookies();
  const headerStore = await headers();

  const cookieLocale = store.get(LOCALE_COOKIE)?.value;

  const locale = getLocaleFromRequest({
    acceptLanguage: headerStore.get("accept-language"),
    cookieLocale,
    overrideLocale: overrideLocale ?? headerStore.get(AUTH_LOCALE_HEADER),
  });

  const translations = await import(`../../messages/${locale}.po`);

  return { locale, messages: translations.default };
});
