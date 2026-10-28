"use client";

import { type PassMarks } from "@zoonk/core/library/exams/pass-marks";
import { getBaseLanguage } from "@zoonk/utils/languages";
import { useExtracted, useLocale } from "next-intl";

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
