"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { useExtracted, useFormatter } from "next-intl";
import { daysBetween, useFormatIsoDate } from "../_utils/iso-date";

/**
 * Why Today proposes moving the phase dates, so "Keep mine" is an informed choice: lessons that
 * take longer than planned and would come after the challenge that tests them (with how far the
 * end moves), a phase's challenge on a day the learner rests (named), the job search lessons
 * keeping the dates leaves out by the goal's date, lessons written since that moving them fits in,
 * or a challenge on a day without room for it.
 */
export function usePhaseDatesSentence() {
  const t = useExtracted();
  const format = useFormatter();
  const formatDate = useFormatIsoDate();

  return (effect: PlanChangeView["effect"]): string => {
    const moves = effect?.phaseEnds ?? [];
    const late = moves.filter((move) => move.lessonsFirst);
    const resting = moves.filter((move) => move.restDay);
    const outcomes = effect?.outcomesAdded ?? [];
    const [first] = late;
    const [rest] = resting;

    // Several are listed under the sentence (see `PhaseEndMoves`). Lessons take longer when the
    // ones written for a topic are longer than planned, or when the learner's pace is slower: "came
    // out longer" read as wrong to a learner back from days away.
    if (late.length > 1) {
      return t(
        "Some lessons are taking longer than planned, so the challenges that end these phases now come before them. Moving their dates fits the lessons in first.",
      );
    }

    if (first) {
      return t(
        "Some lessons are taking longer than planned, so the challenge that ends {phase} now comes before them. Moving that end {days, plural, one {# day} other {# days}} later fits them in first.",
        { days: daysBetween(first.before, first.after), phase: first.name },
      );
    }

    if (resting.length > 1) {
      return t(
        "{count} phase challenges fall on days you rest. Moving your phase dates gives them study days.",
        { count: String(resting.length) },
      );
    }

    if (rest) {
      return t(
        "{phase} ends with a challenge on {day}, a day you rest. Moving your phase dates gives it a study day.",
        { day: formatDate(rest.before, "weekdayDay"), phase: rest.name },
      );
    }

    if (outcomes.length > 0) {
      return t(
        "Keeping your phase dates leaves {outcomes} out by your goal's date. Moving them fits them in.",
        { outcomes: format.list(outcomes, { type: "conjunction" }) },
      );
    }

    if ((effect?.lessonsAdded ?? 0) > 0) {
      return t(
        "Some lessons take more or less time than planned. Moving your phase dates fits more of them before your goal's date.",
      );
    }

    return t(
      "A phase's challenge falls on a day without room for it. Moving your phase dates gives it room.",
    );
  };
}
