"use client";

import { type PassMarks } from "@zoonk/core/library/exams/pass-marks";
import { getBaseLanguage } from "@zoonk/utils/languages";
import { useExtracted, useLocale } from "next-intl";

/**
 * Under pass marks written in another language than the learner's (DELE's notice is in Spanish),
 * which language it is, so a Portuguese screen never quotes Spanish unannounced. Null when they're
 * in the learner's language, or there are none.
 */
export function usePassMarksNote(passMarks: PassMarks | null): string | null {
  const t = useExtracted();
  const locale = useLocale();

  if (!passMarks || passMarks.language === getBaseLanguage(locale)) {
    return null;
  }

  const name = new Intl.DisplayNames([locale], { type: "language" }).of(passMarks.language);

  return t("In {language}, as the exam's documents say it.", {
    language: name ?? passMarks.language,
  });
}
