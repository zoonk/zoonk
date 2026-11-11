"use client";

import { type LanguageAim, isLanguageAim } from "@zoonk/core/language/aims";
import { useExtracted, useFormatter } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";

export function useAimWords() {
  const t = useExtracted();
  const format = useFormatter();
  const formatDate = useFormatIsoDate();

  const labels: Record<LanguageAim, string> = {
    A2: t("Get by on trips"),
    B1: t("Everyday conversations"),
    B2: t("Work or study in it"),
    C1: t("Speak it fluently"),
  };

  return {
    hours: (hours: number) => format.number(hours),
    label: (aim: string | null): string | null => (isLanguageAim(aim) ? labels[aim] : null),
    left: ({ endDate, hours }: { endDate: string | null; hours: number }) =>
      endDate
        ? t({
            description:
              'Under a language level to aim for: the hours of study still needed to reach it, then when. {month} is a month and year, like "Nov 2027".',
            message: "About {hours} h more · around {month}",
            values: { hours: format.number(hours), month: formatDate(endDate, "month") },
          })
        : t({
            description:
              "Under a language level to aim for: the hours of study still needed to reach it.",
            message: "About {hours} h more",
            values: { hours: format.number(hours) },
          }),
    study: (hours: number) => t("About {hours} h of study", { hours: format.number(hours) }),
    title: t({
      description:
        "The language level a course goes up to, like B1. Not the learner's goal: say it as the level they aim for.",
      message: "Your aim",
    }),
  };
}
