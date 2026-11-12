"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { daysBetween, useFormatIsoDate } from "../_utils/iso-date";
import { toLabelCase } from "../_utils/label-case";

/** One thing moves: which, and why in the learner's terms. The moved dates are the change's effect. */
export function usePhaseDatesQuestion() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return (effect: PlanChangeView["effect"]): { title: string; why: string | null } => {
    const moves = effect?.phaseEnds ?? [];
    const late = moves.filter((move) => move.lessonsFirst);
    const resting = moves.filter((move) => move.restDay);
    const [first] = late;
    const [rest] = resting;

    if (late.length > 1) {
      return {
        title: t("Move your phase dates later?"),
        why: t("You finish each phase's lessons first."),
      };
    }

    if (first) {
      return {
        title: t(
          "{days, plural, one {Move the end of {phase} # day later?} other {Move the end of {phase} # days later?}}",
          { days: daysBetween(first.before, first.after), phase: first.name },
        ),
        why: t("You finish its lessons first."),
      };
    }

    if (resting.length > 1) {
      return { title: t("Move your phase dates off rest days?"), why: null };
    }

    if (rest) {
      const day = formatDate(rest.before, "weekday");

      return {
        title: t("Move the end of {phase} off {day}?", { day, phase: rest.name }),
        why: t("{day} is a day you don't study.", { day: toLabelCase(day) }),
      };
    }

    return { title: t("Move your phase dates?"), why: null };
  };
}
