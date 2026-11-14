"use client";

import { type UnderstoodGoalView } from "@zoonk/core/view-models/onboarding/contract";
import { useExtracted } from "next-intl";
import { useLessonLanguageLine } from "../../country/use-country-lines";
import { type UnderstoodRow } from "./use-understood-rows";

/**
 * A country-dependent goal's country, once known: from the learner's words or where they live. One
 * still unknown shows no row, since the next question asks it.
 */
export function useContentCountryRow() {
  const t = useExtracted();
  const lessonLanguage = useLessonLanguageLine();

  return function toContentCountryRow({
    contentCountry,
    language,
    suggested = [],
  }: Pick<UnderstoodGoalView, "contentCountry" | "suggested"> & {
    language: string;
  }): UnderstoodRow | null {
    if (!contentCountry) {
      return null;
    }

    const badges: Partial<Record<typeof contentCountry.source, string>> = {
      home: t({ id: "countryFromHomeBadge", message: "where you live" }),
      said: t("you said"),
    };

    return {
      badge: badges[contentCountry.source],
      ...(contentCountry.editable && {
        contentCountry: { code: contentCountry.code, language, suggested },
        editable: { key: "contentCountry", kind: "contentCountry" },
      }),
      id: "contentCountry",
      label: contentCountry.kind === "exam" ? t("Exam country") : t("Country"),
      note: lessonLanguage(contentCountry.lessonVariety) ?? undefined,
      value: contentCountry.name,
    };
  };
}
