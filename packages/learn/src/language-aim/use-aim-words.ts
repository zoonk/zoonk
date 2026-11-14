"use client";

import { type LanguageAim, isLanguageAim } from "@zoonk/core/language/aims";
import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";

export function useAimWords() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  const labels: Record<LanguageAim, string> = {
    A2: t("Get by on trips"),
    B1: t("Everyday conversations"),
    B2: t("Work or study in it"),
    C1: t("Speak it fluently"),
  };

  return {
    /** When the plan reaches that level at the learner's time; nothing while it isn't known. */
    around: (endDate: string | null): string | undefined =>
      endDate ? t("Around {month}", { month: formatDate(endDate, "month") }) : undefined,
    label: (aim: string | null): string | null => (isLanguageAim(aim) ? labels[aim] : null),
    title: t("Level to reach"),
  };
}
