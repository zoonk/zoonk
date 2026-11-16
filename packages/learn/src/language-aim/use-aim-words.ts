"use client";

import { type LanguageAim, toLanguageAimBand } from "@zoonk/core/language/aims";
import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useLanguageNameInSentence } from "../_utils/use-language-name";

export function useAimWords() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const languageName = useLanguageNameInSentence();

  const labels: Record<LanguageAim, string> = {
    A2: t("Get by on trips"),
    B1: t("Everyday conversations"),
    B2: t("Work or study in it"),
    C1: t("Speak it fluently"),
  };

  return {
    /** When the plan reaches that level at the learner's time; nothing while it isn't known. */
    around: (endDate: string | null): string | undefined =>
      endDate
        ? t("Around {month}", { month: formatDate(endDate, "sentenceMonth", { year: "always" }) })
        : undefined,
    label: (aim: string | null): string | null => {
      const band = toLanguageAimBand(aim);
      return band ? labels[band] : null;
    },
    /** Named with its language, so it isn't read as the game's level. */
    title: (targetLanguage: string | null): string =>
      t({
        description:
          'Titles the language level a learner picks to reach, like "B2". {language} is a language name as in a sentence, like "English".',
        message: "{language} level to reach",
        values: { language: languageName(targetLanguage) },
      }),
  };
}
