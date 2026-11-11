"use client";

import { getVarietyName } from "@zoonk/utils/language-regions";
import { useExtracted } from "next-intl";
import { useAppLocale } from "../_utils/locale";

export type LessonVariety = { language: string; region: string };

/**
 * "Lesson language: Portuguese (Brazil)": the variety lessons are written in, for a country where
 * the language is spoken differently. Core sends it only then, so null draws nothing.
 */
export function useLessonLanguageLine() {
  const t = useExtracted();
  const locale = useAppLocale();

  return (variety: LessonVariety | null): string | null =>
    variety &&
    t({
      description:
        "{variety} is a language with its country, such as “Portuguese (Brazil)”. It always follows the colon, so it never needs an article or a case.",
      message: "Lesson language: {variety}",
      values: { variety: getVarietyName({ ...variety, userLanguage: locale }) },
    });
}
