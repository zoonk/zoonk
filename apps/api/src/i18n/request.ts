import { LOCALE_COOKIE, getLocaleFromHeaders } from "@zoonk/utils/locale";
import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

export default getRequestConfig(async () => {
  const store = await cookies();
  const headerStore = await headers();

  const cookieLocale = store.get(LOCALE_COOKIE)?.value;

  const locale = cookieLocale || getLocaleFromHeaders(headerStore.get("accept-language"));

  const translations = await import(`../../messages/${locale}.po`);

  return {
    locale,
    messages: translations.default,
  };
});
