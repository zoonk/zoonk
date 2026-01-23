import { match } from "@formatjs/intl-localematcher";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import Negotiator from "negotiator";
import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

function getLocaleFromHeaders(acceptLanguage: string | null): string {
  if (!acceptLanguage) {
    return DEFAULT_LOCALE;
  }

  const negotiator = new Negotiator({
    headers: { "accept-language": acceptLanguage },
  });
  const languages = negotiator.languages();

  try {
    return match(languages, SUPPORTED_LOCALES, DEFAULT_LOCALE);
  } catch {
    return DEFAULT_LOCALE;
  }
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const headerStore = await headers();

  const cookieLocale = store.get("locale")?.value;

  const locale = cookieLocale || getLocaleFromHeaders(headerStore.get("accept-language"));

  return {
    locale,
    messages: (await import(`../../messages/${locale}.po`)).default,
  };
});
