import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";

type ChangeEffect = PlanChangeView["effect"];

/**
 * Whether a change's lessons count against the plan's date (`targetDate`, null without one still
 * ahead): only then do lessons fit or no longer fit by it. A full-course exam plan may grow after
 * the exam, so its count isn't one by the date.
 */
export function countsByDate(effect: ChangeEffect, targetDate: string | null): boolean {
  return targetDate !== null && (!effect?.endDateAfter || effect.endDateAfter <= targetDate);
}

/** The net count first, then one explanation for every automatic re-estimate. */
export function useEstimateSentence({ targetDate = null }: { targetDate?: string | null } = {}) {
  const t = useExtracted();

  const countSentence = (effect: ChangeEffect, more: number): string => {
    if (!countsByDate(effect, targetDate)) {
      if (more < 0) {
        return t(
          "{lessons, plural, one {Your goal takes # fewer lesson.} other {Your goal takes # fewer lessons.}}",
          { lessons: -more },
        );
      }

      return effect?.lessonsAddedEstimated
        ? t(
            "{lessons, plural, one {Your goal takes about # more lesson.} other {Your goal takes about # more lessons.}}",
            { lessons: more },
          )
        : t(
            "{lessons, plural, one {Your goal takes # more lesson.} other {Your goal takes # more lessons.}}",
            { lessons: more },
          );
    }

    if (more < 0) {
      return t(
        "{lessons, plural, one {# lesson no longer fits by your date.} other {# lessons no longer fit by your date.}}",
        { lessons: -more },
      );
    }

    // Lessons not written yet count as their topic's estimate, as the diff's "Adds about" says.
    return effect?.lessonsAddedEstimated
      ? t(
          "{lessons, plural, one {About # more lesson fits by your date.} other {About # more lessons fit by your date.}}",
          { lessons: more },
        )
      : t(
          "{lessons, plural, one {# more lesson fits by your date.} other {# more lessons fit by your date.}}",
          { lessons: more },
        );
  };

  return function estimateSentence(effect: ChangeEffect): string | null {
    const more = (effect?.lessonsAdded ?? 0) - (effect?.lessonsRemoved ?? 0);

    return more === 0
      ? null
      : `${countSentence(effect, more)} ${t("We now plan for the time your lessons need.")}`;
  };
}
