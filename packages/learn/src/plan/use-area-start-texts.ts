"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";

type AreaStarts = NonNullable<NonNullable<PlanChangeView["effect"]>["areaStarts"]>;

/**
 * When a focused area starts with the change: "You start Portfolio on Dec 17 instead of Dec 24.",
 * or that it keeps its start (it already comes as early as it can). The learner is the subject, so
 * an area named as a part ("Biologia e química") never needs its verb to agree with it.
 */
export function useAreaStartTexts() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return function areaStartTexts(starts: AreaStarts): string[] {
    return starts.flatMap(({ after, area, before }) => {
      if (!after) {
        return [];
      }

      if (!before || after < before) {
        return before
          ? [
              t("You start {area} on {after} instead of {before}.", {
                after: formatDate(after, "long"),
                area,
                before: formatDate(before, "long"),
              }),
            ]
          : [t("You start {area} on {after}.", { after: formatDate(after, "long"), area })];
      }

      return [t("You still start {area} on {after}.", { after: formatDate(after, "long"), area })];
    });
  };
}
