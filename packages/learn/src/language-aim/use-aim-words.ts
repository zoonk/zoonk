"use client";

import { type LanguageAim, toLanguageAimBand } from "@zoonk/core/language/aims";
import { useExtracted } from "next-intl";
import { type FinishForecast } from "../_components/finish-readout";
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
    around: (forecast: FinishForecast | null): string | undefined => {
      if (forecast?.finishReason === "beyondHorizon") {
        return t({
          description:
            "Under a language level to aim for, when reaching it takes more than ten years at the learner's time.",
          message: "In 10+ years",
        });
      }

      if (!forecast?.endDate) {
        return undefined;
      }

      return forecast.precision === "year"
        ? t({
            description: 'When a language level is reached. {year} is a year, like "2031".',
            message: "Around {year}",
            values: { year: formatDate(forecast.endDate, "year") },
          })
        : t("Around {month}", {
            month: formatDate(forecast.endDate, "sentenceMonth", { year: "always" }),
          });
    },
    label: (aim: string | null): string | null => {
      const band = toLanguageAimBand(aim);
      return band ? labels[band] : null;
    },
    /** Named with its language, so it isn't read as the game's level. */
    title: (targetLanguage: string | null): string =>
      targetLanguage
        ? t({
            description:
              'Titles the language level a learner picks to reach, like "B2". {language} is a language name as in a sentence, like "English".',
            message: "{language} level to reach",
            values: { language: languageName(targetLanguage) },
          })
        : t("How far do you want to go?"),
  };
}
