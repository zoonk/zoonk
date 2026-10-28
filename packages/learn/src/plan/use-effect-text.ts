"use client";

import { type PlanOperation } from "@zoonk/core/plans/contract";
import { type PlanChangeView, type PlanView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { getShownEndMove } from "../plan-diff/end-move";
import { useFormatPlanDate } from "./plan-date-text";
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

type CurrentEnd = Pick<PlanView["estimate"], "endDate"> & Pick<PlanView["schedule"], "targetDate">;

/** Only a plan without a date says its new end, and only while the change starts from the end the plan shows now. */
function usePlanEndEffectText() {
  const t = useExtracted();
  const formatPlanDate = useFormatPlanDate();

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

    const after = formatPlanDate(move.after);
    const before = formatPlanDate(move.before);

    if (before !== formatPlanDate(current.endDate) || after === before) {
      return null;
    }

    return t("Ends around {after} instead of {before}.", { after, before });
  };
}

type AppliedPlan = Pick<PlanView["schedule"], "fullCourse" | "targetDate">;

function removesDate(operations: readonly PlanOperation[]): boolean {
  return operations.some(
    (operation) =>
      (operation.kind === "setTargetDate" && operation.targetDate === null) ||
      (operation.kind === "setFullCourse" && operation.fullCourse),
  );
}

/** A plan the change took the date off says its end by month: "instead of" the last lesson's day misread as the deadline. */
function useAppliedEndText() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const formatPlanDate = useFormatPlanDate();

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

    if (!before || !getShownEndMove(change.effect)) {
      return null;
    }

    const shown = (isoDate: string) =>
      plan.targetDate ? formatDate(isoDate, "month") : formatPlanDate(isoDate);

    return shown(after) === shown(before)
      ? null
      : t("Ends around {after} instead of {before}.", {
          after: shown(after),
          before: shown(before),
        });
  };
}

export function useProposalEffectText() {
  const effectText = useChangeEffectText();
  const planEndEffect = usePlanEndEffectText();
  const sentences = useEffectSentences();

  return function proposalEffectText(
    change: Pick<PlanChangeView, "effect">,
    current?: CurrentEnd,
    { besideDiff = false, byDate = true }: { besideDiff?: boolean; byDate?: boolean } = {},
  ): string | null {
    return sentences(
      change,
      current ? planEndEffect({ current, effect: change.effect }) : effectText(change),
      { besideDiff, byDate },
    );
  };
}

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
    const ends = change.effect?.areaEnds ?? [];

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
