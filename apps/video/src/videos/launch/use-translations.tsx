import { createContext, useContext } from "react";
import { type Locale, getTranslations } from "./translations";

type TranslationStrings = ReturnType<typeof getTranslations>;

const TranslationContext = createContext<TranslationStrings>(getTranslations("en"));

/**
 * Provides translations to all scenes in the video.
 * Wrap the composition in this provider with the locale prop.
 */
export function TranslationProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const t = getTranslations(locale);
  return <TranslationContext.Provider value={t}>{children}</TranslationContext.Provider>;
}

/**
 * Returns all translation strings for the current locale.
 * Use in any scene component to access translated text.
 */
export function useT(): TranslationStrings {
  return useContext(TranslationContext);
}
