import { LOCALE_COOKIE, isValidLocale } from "@zoonk/utils/locale";
import { getLocaleFromRequest } from "@zoonk/utils/locale-request";
import { cookies, headers } from "next/headers";

const translations = {
  de: () => import("./de.json").then((module) => module.default),
  en: () => import("./en.json").then((module) => module.default),
  es: () => import("./es.json").then((module) => module.default),
  fr: () => import("./fr.json").then((module) => module.default),
  it: () => import("./it.json").then((module) => module.default),
  ja: () => import("./ja.json").then((module) => module.default),
  ko: () => import("./ko.json").then((module) => module.default),
  pl: () => import("./pl.json").then((module) => module.default),
  pt: () => import("./pt.json").then((module) => module.default),
  tr: () => import("./tr.json").then((module) => module.default),
};

export function getTranslation(locale: string) {
  const safeLocale: keyof typeof translations = isValidLocale(locale) ? locale : "en";
  return translations[safeLocale]();
}

export async function getRequestTranslation() {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);

  const locale = getLocaleFromRequest({
    acceptLanguage: headerStore.get("accept-language"),
    cookieLocale: cookieStore.get(LOCALE_COOKIE)?.value,
  });

  return getTranslation(locale);
}
