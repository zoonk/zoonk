"use client";

import { type PassMarks } from "@zoonk/core/library/exams/pass-marks";
import { getBaseLanguage, getLanguageNameInSentence } from "@zoonk/utils/languages";
import { useExtracted } from "next-intl";
import { useAppLocale } from "./locale";

export function usePassMarksNote(passMarks: PassMarks | null): string | null {
  const t = useExtracted();
  const locale = useAppLocale();

  if (!passMarks || passMarks.language === getBaseLanguage(locale)) {
    return null;
  }

  return t("In {language}, as the exam's documents say it.", {
    language: getLanguageNameInSentence({
      targetLanguage: passMarks.language,
      userLanguage: locale,
    }),
  });
}
