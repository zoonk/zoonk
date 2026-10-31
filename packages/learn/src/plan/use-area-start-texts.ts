"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { useExtracted, useFormatter } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";

type AreaStarts = NonNullable<NonNullable<PlanChangeView["effect"]>["areaStarts"]>;
type AreaEnds = NonNullable<NonNullable<PlanChangeView["effect"]>["areaEnds"]>;
type AreaLessons = NonNullable<NonNullable<PlanChangeView["effect"]>["areaLessons"]>;

/** The learner is the subject, so an area's name never needs a verb to agree with it. */
export function useAreaStartTexts() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return function areaStartTexts(starts: AreaStarts): string[] {
    return starts.flatMap(({ after, area, before }) => {
      if (!after) {
        return [];
      }

      if (!before || after !== before) {
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

export function useAreaEndTexts() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return function areaEndTexts(ends: AreaEnds, { estimated = false } = {}): string[] {
    return ends.map(({ after, area, before, lessonsGained = 0 }) => {
      const dates = { after: formatDate(after, "long"), area, before: formatDate(before, "long") };

      if (after === before) {
        return t({
          description: '{after} is a day, like "May 5".',
          message:
            "You still finish {area} around {after}, with all its lessons: everything fits by your date.",
          values: dates,
        });
      }

      if (lessonsGained > 0 && after > before) {
        return estimated
          ? t({
              description: '{after} and {before} are days, like "May 5".',
              message:
                "{area} gets about {count, plural, one {# more lesson} other {# more lessons}}, so you finish it around {after} instead of {before}.",
              values: { ...dates, count: lessonsGained },
            })
          : t({
              description: '{after} and {before} are days, like "May 5".',
              message:
                "{area} gets {count, plural, one {# more lesson} other {# more lessons}}, so you finish it around {after} instead of {before}.",
              values: { ...dates, count: lessonsGained },
            });
      }

      if (lessonsGained < 0 && after < before) {
        return t({
          description: '{after} and {before} are days, like "May 5".',
          message:
            "{area} has {count, plural, one {# lesson} other {# lessons}} fewer to go, so you finish it around {after} instead of {before}.",
          values: { ...dates, count: -lessonsGained },
        });
      }

      return t({
        description: '{after} and {before} are days, like "May 5".',
        message: "You finish {area} around {after} instead of {before}.",
        values: dates,
      });
    });
  };
}

export function useAreaLessonTexts() {
  const t = useExtracted();

  return function areaLessonTexts(areas: AreaLessons): string[] {
    return areas.map(({ after, area, before }) =>
      t(
        "{area}: {after, plural, =0 {# lessons} one {# lesson} other {# lessons}} to go instead of {before, number}.",
        { after, area, before },
      ),
    );
  };
}

export function useAddedTopicsStartText() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return function addedTopicsStartText(effect: PlanChangeView["effect"]): string | null {
    const start = effect?.addedTopicsStart;

    if (!start) {
      return null;
    }

    const date = formatDate(start, "long");

    return effect.addedTopicsBeforeBasics
      ? t("The new lessons start on {date}, before the basics.", { date })
      : t("The new lessons start on {date}.", { date });
  };
}

export function useReviewFirstText() {
  const t = useExtracted();
  const format = useFormatter();
  const formatDate = useFormatIsoDate();

  return function reviewFirstText(effect: PlanChangeView["effect"]): string | null {
    const review = effect?.reviewFirst;

    return review
      ? t("Your review on {date} starts with {areas}.", {
          areas: format.list(review.areas, { type: "conjunction" }),
          date: formatDate(review.date, "long"),
        })
      : null;
  };
}
