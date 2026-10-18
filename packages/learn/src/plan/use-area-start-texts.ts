"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { useExtracted, useFormatter } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";

type AreaStarts = NonNullable<NonNullable<PlanChangeView["effect"]>["areaStarts"]>;
type AreaEnds = NonNullable<NonNullable<PlanChangeView["effect"]>["areaEnds"]>;
type AreaLessons = NonNullable<NonNullable<PlanChangeView["effect"]>["areaLessons"]>;

/**
 * When a focused area starts with the change: "You start Portfolio on Dec 17 instead of Dec 24."
 * (the day their plan shows now), or that it keeps its start (it already comes as early as it
 * can). The learner is the subject, so an area named as a part ("Biology and chemistry") never needs
 * its verb to agree with it.
 */
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

/**
 * When an area given more or less time is done with the change: "You finish Civil Law around
 * Dec 4 instead of Feb 2." With every lesson in the plan, that's what more or less of it changes.
 * Short on time, more of an area brings more of its lessons in, which can end it later, and the
 * card says why, in the same sentence: "Linguagens gets about 82 more lessons, so you finish it
 * around Oct 29 instead of Aug 10." (Ana read only that she'd finish it two and a half months
 * later, two weeks before her exam: its added depth comes at the plan's end.) It's "about" while
 * some of the lessons the change adds aren't written (`estimated`). Less of an area that keeps all
 * of it, since everything fits, says so: "less natural sciences" never reads as doing something it
 * didn't.
 * Said as an estimate: lessons not written yet are sized by the plan's guess, and the dates settle
 * as they're written (Sofia's "November 19" became the 12th minutes later).
 */
export function useAreaEndTexts() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return function areaEndTexts(ends: AreaEnds, { estimated = false } = {}): string[] {
    return ends.map(({ after, area, before, lessonsGained = 0 }) => {
      const dates = { after: formatDate(after, "long"), area, before: formatDate(before, "long") };

      if (after === before) {
        return t(
          "You still finish {area} around {after}, with all its lessons: everything fits by your date.",
          dates,
        );
      }

      if (lessonsGained > 0 && after > before) {
        return estimated
          ? t(
              "{area} gets about {count, plural, one {# more lesson} other {# more lessons}}, so you finish it around {after} instead of {before}.",
              { ...dates, count: lessonsGained },
            )
          : t(
              "{area} gets {count, plural, one {# more lesson} other {# more lessons}}, so you finish it around {after} instead of {before}.",
              { ...dates, count: lessonsGained },
            );
      }

      if (lessonsGained < 0 && after < before) {
        return t(
          "{area} has {count, plural, one {# lesson} other {# lessons}} fewer to go, so you finish it around {after} instead of {before}.",
          { ...dates, count: -lessonsGained },
        );
      }

      return t("You finish {area} around {after} instead of {before}.", dates);
    });
  };
}

/**
 * How many lessons an area the change doesn't name has to go with it: "Criminal procedure: 44
 * lessons to go instead of 40." The time a focus or "less" moves can reach other areas, and none
 * moves without the learner knowing.
 */
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

/**
 * When the topics the learner asked to add start with the change ("The new lessons start on Oct
 * 9."), so a card never leaves them guessing: Carla asked to start her school's project soon,
 * and nothing said it came seven weeks later. Topics asked for now that come ahead of the plan's
 * first phase say so. Null when the change adds none.
 */
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

/**
 * The review day ahead a focus opens with its topics: "Your review on Oct 9 starts with Osmosis and
 * organelles." A class test's day before has no lessons for a focus to move, only its questions.
 */
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
