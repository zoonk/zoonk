"use client";

import { getLanguageNameInSentence } from "@zoonk/utils/languages";
import { useAppLocale } from "./locale";

export function useLanguageNameInSentence() {
  const locale = useAppLocale();

  return (targetLanguage: string | null) =>
    targetLanguage ? getLanguageNameInSentence({ targetLanguage, userLanguage: locale }) : "";
}
