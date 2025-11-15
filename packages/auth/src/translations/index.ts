const translations = {
  en: () => import("./en.json").then((module) => module.default),
  es: () => import("./es.json").then((module) => module.default),
  pt: () => import("./pt.json").then((module) => module.default),
};

type Locale = keyof typeof translations;

function isLocale(value: string): value is Locale {
  return value in translations;
}

export function getTranslation(locale: string) {
  const safeLocale: Locale = isLocale(locale) ? locale : "en";
  return translations[safeLocale]();
}
