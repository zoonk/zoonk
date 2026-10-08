"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";

type ChangeEffect = PlanChangeView["effect"];

/**
 * The lessons a change adds and leaves out, both when it does both ("Adds 45 lessons and leaves
 * out 21."), so the card says what the buddy says and nothing leaves the plan unsaid.
 */
export function useLessonsEffectText() {
  const t = useExtracted();

  return function lessonsText(effect: ChangeEffect): string | null {
    const added = effect?.lessonsAdded ?? 0;
    const removed = effect?.lessonsRemoved ?? 0;

    if (added > 0 && removed > 0) {
      return t(
        "Adds {added, plural, one {# lesson} other {# lessons}} and leaves out {removed, number}.",
        { added, removed },
      );
    }

    if (added > 0) {
      return t("Adds {lessons, plural, one {# lesson} other {# lessons}}.", { lessons: added });
    }

    return removed > 0
      ? t("Leaves out {lessons, plural, one {# lesson} other {# lessons}}.", { lessons: removed })
      : null;
  };
}

/** "6 topics leave the plan." for a change that leaves notice topics out; null otherwise. */
export function useTopicsEffectText() {
  const t = useExtracted();

  return function topicsText(effect: ChangeEffect): string | null {
    const count = (effect?.topicsLeftOut ?? []).reduce((sum, area) => sum + area.topics.length, 0);

    return count > 0
      ? t("{count, plural, one {# topic leaves the plan.} other {# topics leave the plan.}}", {
          count,
        })
      : null;
  };
}
