import { isValidLocale } from "@zoonk/utils/locale";

const translations = {
  de: () => import("./de.json").then((module) => module.default),
  en: () => import("./en.json").then((module) => module.default),
  es: () => import("./es.json").then((module) => module.default),
  fr: () => import("./fr.json").then((module) => module.default),
  pt: () => import("./pt.json").then((module) => module.default),
};

export function getTranslation(locale: string) {
  const safeLocale: keyof typeof translations = isValidLocale(locale) ? locale : "en";
  return translations[safeLocale]();
}
