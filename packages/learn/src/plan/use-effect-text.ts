"use client";

import { type PlanOperation } from "@zoonk/core/plans/contract";
import { type PlanChangeView, type PlanView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { getShownEndMove } from "../plan-diff/end-move";
import {
  useAddedTopicsStartText,
  useAreaEndTexts,
  useAreaLessonTexts,
  useAreaStartTexts,
  useReviewFirstText,
} from "./use-area-start-texts";
import { useLessonsEffectText, useTopicsEffectText } from "./use-effect-counts";
import { usePhaseEndsText } from "./use-phase-ends-text";
import { useNextMockText, useWeeklyEventsText } from "./use-weekday-texts";

/**
 * How a change moves the end: "Ends Nov 20 instead of Nov 12". Null when the end stays, or moves
 * too little to say beside the lessons the change moves (see `getShownEndMove`).
 */
function useChangeEffectText() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return function effectText(change: Pick<PlanChangeView, "effect">): string | null {
    const move = getShownEndMove(change.effect);

    if (!move) {
      return null;
    }

    return t("Ends {after} instead of {before}.", {
      after: formatDate(move.after, "long"),
      before: formatDate(move.before, "long"),
    });
  };
}

/** The plan as it is now, so a waiting change's effect never names an end the plan doesn't show. */
type CurrentEnd = Pick<PlanView["estimate"], "endDate"> & Pick<PlanView["schedule"], "targetDate">;

function toMonth(isoDate: string): string {
  return isoDate.slice(0, "YYYY-MM".length);
}

/**
 * The end a change moves, in the plan's own terms. A plan with a date keeps it, so only a plan
 * without one says its new end, by month as its title does, and only while the change starts from
 * the end the plan shows now: an older change's dates would contradict it.
 */
function usePlanEndEffectText() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return function planEndEffect({
    current,
    effect,
  }: {
    current: CurrentEnd;
    effect: PlanChangeView["effect"];
  }): string | null {
    const move = getShownEndMove(effect);

    if (current.targetDate || !current.endDate || !move) {
      return null;
    }

    const { after, before } = move;

    if (toMonth(before) !== toMonth(current.endDate) || toMonth(after) === toMonth(before)) {
      return null;
    }

    return t("Ends around {after} instead of {before}.", {
      after: formatDate(after, "month"),
      before: formatDate(before, "month"),
    });
  };
}

/** The plan on screen once a change applied: its date, and whether an exam's goes on past it. */
type AppliedPlan = Pick<PlanView["schedule"], "fullCourse" | "targetDate">;

/** Whether a change takes the plan's end off its date: no deadline, or an exam studied past it. */
function removesDate(operations: readonly PlanOperation[]): boolean {
  return operations.some(
    (operation) =>
      (operation.kind === "setTargetDate" && operation.targetDate === null) ||
      (operation.kind === "setFullCourse" && operation.fullCourse),
  );
}

/**
 * How a change the learner made moves the end, said as the plan on screen now says it: a plan with
 * a date ends at it, so nothing; a plan the change took the date off finishes around a month,
 * since "instead of" the day the last lesson fell on misread as their deadline (Maya's March 1
 * deadline read "instead of February 28"); a plan without a date before and after, by month, as
 * its title says it.
 */
function useAppliedEndText() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return function appliedEndText(
    change: Pick<PlanChangeView, "effect" | "operations">,
    plan: AppliedPlan,
  ): string | null {
    const after = change.effect?.endDateAfter;
    const before = change.effect?.endDateBefore;

    if (!after || (plan.targetDate && !plan.fullCourse)) {
      return null;
    }

    if (removesDate(change.operations)) {
      return t("You finish around {month}.", { month: formatDate(after, "month") });
    }

    return before && getShownEndMove(change.effect) && toMonth(after) !== toMonth(before)
      ? t("Ends around {after} instead of {before}.", {
          after: formatDate(after, "month"),
          before: formatDate(before, "month"),
        })
      : null;
  };
}

/**
 * What a proposal does, for the learner to weigh before saying yes: "Adds 6 lessons. Ends Nov 20
 * instead of Nov 12." or "Leaves out 56 lessons." With `current` (the plan on screen), its end is
 * said the plan's way, or not at all when the plan has a date. Null when it neither changes how
 * many lessons are left nor moves the end.
 */
export function useProposalEffectText() {
  const effectText = useChangeEffectText();
  const planEndEffect = usePlanEndEffectText();
  const sentences = useEffectSentences();

  return function proposalEffectText(
    change: Pick<PlanChangeView, "effect">,
    current?: CurrentEnd,
    {
      besideDiff = false,
      byDate = true,
    }: {
      /** Said over its diff, which counts the lessons first: their count isn't said again. */
      besideDiff?: boolean;
      /** Its lessons count against a date still ahead, as its diff's (`PlanEffectDiff`). */
      byDate?: boolean;
    } = {},
  ): string | null {
    return sentences(
      change,
      current ? planEndEffect({ current, effect: change.effect }) : effectText(change),
      { besideDiff, byDate },
    );
  };
}

/**
 * What a change the learner just made did, beside its sentence, in the sheet that made it: as a
 * proposal says it (see `useProposalEffectText`), its end as the plan now on screen says it (see
 * `useAppliedEndText`).
 */
export function useAppliedEffectText() {
  const appliedEndText = useAppliedEndText();
  const sentences = useEffectSentences();

  return function appliedEffectText(
    change: Pick<PlanChangeView, "effect" | "operations">,
    plan: AppliedPlan,
  ): string | null {
    return sentences(change, appliedEndText(change, plan));
  };
}

/** What a change does past its sentence, with its end as the caller says it (`endText`). */
function useEffectSentences() {
  const lessonsText = useLessonsEffectText();
  const topicsText = useTopicsEffectText();
  const areaStartTexts = useAreaStartTexts();
  const areaEndTexts = useAreaEndTexts();
  const areaLessonTexts = useAreaLessonTexts();
  const addedTopicsStartText = useAddedTopicsStartText();
  const reviewFirstText = useReviewFirstText();
  const weeklyEventsText = useWeeklyEventsText();
  const nextMockText = useNextMockText();
  const phaseEndsText = usePhaseEndsText();

  return function effectSentences(
    change: Pick<PlanChangeView, "effect">,
    endText: string | null,
    { besideDiff = false, byDate = true }: { besideDiff?: boolean; byDate?: boolean } = {},
  ): string | null {
    // With a review ahead that the focus opens, a start that stays says nothing the review doesn't.
    const ends = change.effect?.areaEnds ?? [];

    // A start that stays says nothing when a review ahead opens with the area, or its end moves.
    const starts = (change.effect?.areaStarts ?? []).filter(
      (start) =>
        start.after !== start.before ||
        (!change.effect?.reviewFirst && !ends.some((end) => end.area === start.area)),
    );

    const sentences = [
      ...areaStartTexts(starts),
      ...areaEndTexts(ends, { estimated: change.effect?.lessonsAddedEstimated }),
      ...areaLessonTexts(change.effect?.areaLessons ?? []),
      reviewFirstText(change.effect),
      weeklyEventsText(change.effect),
      nextMockText(change.effect),
      lessonsText(change.effect, { byDate, named: besideDiff }),
      phaseEndsText(change.effect),
      addedTopicsStartText(change.effect),
      topicsText(change.effect),
      endText,
    ].filter(Boolean);

    return sentences.length > 0 ? sentences.join(" ") : null;
  };
}
