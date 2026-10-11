"use client";

import { type TodayView } from "@zoonk/core/view-models/today/get";
import { useExtracted } from "next-intl";
import { useChangeSentence } from "../plan/use-change-sentence";

type Change = NonNullable<TodayView["planChange"]>;

/** "We skipped 3 lessons of Electric circuits"; any other change in the plan's own words. */
export function useTodayChangeSentence() {
  const t = useExtracted();
  const changeSentence = useChangeSentence();

  return (change: Change): string => {
    if (change.kind !== "testedOut") {
      return changeSentence(change);
    }

    return change.chapterTitle
      ? t("We skipped {lessons, plural, one {# lesson} other {# lessons}} of {chapter}", {
          chapter: change.chapterTitle,
          lessons: change.lessonsSkipped,
        })
      : t("We skipped {lessons, plural, one {# lesson} other {# lessons}} you already know", {
          lessons: change.lessonsSkipped,
        });
  };
}
