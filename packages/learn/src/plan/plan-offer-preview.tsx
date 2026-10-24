"use client";

import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { ChevronDownIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  SuggestionAction,
  SuggestionActions,
  SuggestionDescription,
} from "../_components/suggestion";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { PlanEffectDiff } from "../plan-diff/plan-effect-diff";
import { usePlanScreen } from "./plan-context";
import { useCanChooseFocus, useChooseFocus } from "./plan-focus";
import { useFullCourse, useFullCourseText } from "./plan-full-course";
import { type SlotItem, type SlotPreview, usePlanSuggestionSlot } from "./plan-suggestion-context";
import { useStudyEverything } from "./study-everything";
import { useChangeSentence } from "./use-change-sentence";
import { usePlanChange } from "./use-plan-change";
import { readTimeToCover, useTimeToCoverTexts } from "./use-time-to-cover";

/*
 * What the Plan's suggestions offer and show before Apply: the change a coverage card offers (the
 * find answer's time or date, an exam's end), its preview as a diff with Apply, and the card's
 * other ways on. The past-date card shares the preview.
 */

/** The goal's own date a change moves, from the one the plan has. */
type GoalDateMove = { after: string; before: string | null };

/** The goal's date `operations` move, for the diff to show beside its lessons; none otherwise. */
export function getGoalDateMove({
  operations,
  targetDate,
}: {
  operations: LearnerPlanOperation[];
  targetDate: string | null;
}): GoalDateMove | undefined {
  const [operation] = operations;

  return operation?.kind === "setTargetDate" && operation.targetDate
    ? { after: operation.targetDate, before: targetDate }
    : undefined;
}

/**
 * Applies the slot's previewed change for `item`, never without the diff it makes, then says what
 * it did where the suggestion was, with Undo (see `SlotResult`).
 */
export function useApplyPreview(item: SlotItem) {
  const t = useExtracted();
  const sentence = useChangeSentence();
  const { change, failed, isPending } = usePlanChange();
  const { setPreview, setResult } = usePlanSuggestionSlot();

  const apply = (preview: SlotPreview) => {
    if (
      preview.status !== "ready" ||
      preview.preview.unchanged ||
      preview.preview.effect === null
    ) {
      return;
    }

    void change(preview.operations, (outcome) => {
      if (outcome?.status === "applied") {
        setPreview();

        setResult({
          change: outcome.change,
          item,
          text: outcome.change ? sentence(outcome.change) : t("Your plan is updated."),
        });
      }
    });
  };

  return { apply, failed, isPending };
}

/**
 * What the offer does before it's applied: the plan's dates that move, as a diff. While it's being
 * checked, and when it couldn't be, it says so in place over the same row of actions, so the panel
 * doesn't jump, with the way to read it again (`onRetry`) or put it off.
 */
export function OfferPreview({
  goalDate,
  onApply,
  onRetry,
  pending,
  preview,
}: {
  /** The goal's own date the change moves, from the one the plan has (see `PlanEffectDiff`). */
  goalDate?: GoalDateMove;
  onApply: () => void;
  onRetry: () => void;
  pending: boolean;
  preview: SlotPreview;
}) {
  const t = useExtracted();
  const { setPreview } = usePlanSuggestionSlot();

  if (preview.status === "loading") {
    return (
      <>
        <SuggestionDescription aria-busy="true" role="status">
          {t("Checking what changes…")}
        </SuggestionDescription>
        <SuggestionActions>
          {/* Keyed, so a focused Try again never turns into the Not now beside it. */}
          <SuggestionAction key="not-now" onClick={() => setPreview()} variant="outline">
            {t("Not now")}
          </SuggestionAction>
        </SuggestionActions>
      </>
    );
  }

  if (preview.status === "failed") {
    return (
      <>
        <SuggestionDescription role="status">
          {t("We couldn't check what changes.")}
        </SuggestionDescription>
        <SuggestionActions>
          <SuggestionAction key="retry" onClick={onRetry}>
            {t("Try again")}
          </SuggestionAction>
          <SuggestionAction key="not-now" onClick={() => setPreview()} variant="outline">
            {t("Not now")}
          </SuggestionAction>
        </SuggestionActions>
      </>
    );
  }

  if (preview.status !== "ready") {
    return null;
  }

  const { effect, feasibility, unchanged } = preview.preview;

  return (
    <>
      {unchanged ? (
        <SuggestionDescription>{t("Your plan stays as it is.")}</SuggestionDescription>
      ) : (
        <PlanEffectDiff effect={effect} goalDate={goalDate} />
      )}

      {!unchanged && feasibility?.fits && (
        <SuggestionDescription>
          {t("Your plan then covers everything in depth.")}
        </SuggestionDescription>
      )}

      <SuggestionActions>
        {/* Never applied without the diff it makes, as Today's proposals. */}
        {!unchanged && effect !== null && (
          <SuggestionAction disabled={pending} onClick={onApply}>
            {t("Apply")}
          </SuggestionAction>
        )}
        <SuggestionAction disabled={pending} onClick={() => setPreview()} variant="outline">
          {t("Not now")}
        </SuggestionAction>
      </SuggestionActions>
    </>
  );
}

/**
 * "Checking what changes…" while a goal's new date is being found before its preview (the menu's
 * Move your date, a past date's Preview), as the preview says it once found, with the way to put
 * it off (`onCancel`).
 */
export function CheckingChange({ onCancel }: { onCancel: () => void }) {
  const t = useExtracted();

  return (
    <>
      <SuggestionDescription aria-busy="true" role="status">
        {t("Checking what changes…")}
      </SuggestionDescription>
      <SuggestionActions>
        <SuggestionAction key="not-now" onClick={onCancel} variant="outline">
          {t("Not now")}
        </SuggestionAction>
      </SuggestionActions>
    </>
  );
}

/** The change the suggestion offers, in words and as the operations that make it. */
export type CoverageOffer = {
  description: string[];
  operations: LearnerPlanOperation[];
  title: string;
};

/** What the learner asked the card for: the time that covers everything, or a goal's new date. */
export type Intent = "date" | "time";

/**
 * The change a find answer offers (see `useTimeToCover`), all of it exact, since it was planned:
 * asked for a date, the earliest one the learner's own time covers everything by; asked for
 * time, the time found, or when no time covers everything, a goal's new date when it has one.
 * Null when nothing is worth one tap: no time covers everything and no date was found.
 */
export function useAnswerOffer() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const formatDate = useFormatIsoDate();
  const texts = useTimeToCoverTexts();
  const { goal } = usePlanScreen();

  return function answerOffer({
    covered,
    intent,
    time,
  }: {
    /** What the learner's own time covers (see `useCoveredText`). */
    covered: string;
    intent: Intent;
    time: PlanTimeToCover;
  }): CoverageOffer | null {
    const answer = readTimeToCover(time);
    const { fittingDate, targetDate, targetDateNamedMonth } = time;

    const none =
      answer.kind === "none" && targetDate
        ? texts.none({ targetDate, targetDateNamedMonth })
        : null;

    if (goal.kind !== "exam" && fittingDate && (intent === "date" || answer.kind !== "covers")) {
      return {
        description: intent === "date" || !none ? [covered] : [covered, none],
        operations: [{ kind: "setTargetDate", targetDate: fittingDate }],
        title: t("Your time covers everything by {date}", {
          date: formatDate(fittingDate, "long"),
        }),
      };
    }

    if (intent === "date" || answer.kind === "none") {
      return null;
    }

    return {
      description: [covered],
      operations: [{ kind: "setDailyMinutes", minutes: answer.minutes }],
      title: t("{time} a day covers everything in depth", { time: formatDuration(answer.minutes) }),
    };
  };
}

/**
 * What the card offers without asking anything: an exam studying everything can end at the exam
 * again, a change worked out from the plan as it is. Null otherwise: the rest is the learner's to
 * ask for (Find, Move your date).
 */
export function useCourseOffer(): CoverageOffer | null {
  const t = useExtracted();
  const course = useFullCourse();
  const text = useFullCourseText();

  if (!course?.on) {
    return null;
  }

  return {
    description: [t("Until the exam, what comes up most comes first.")],
    operations: course.operations(false),
    title: text.finish(course) ?? t("Every topic, even after the exam, at your own pace."),
  };
}

/**
 * The other ways to change what the plan covers, in one menu: moving a goal's date (unless it's
 * the offer already), choosing where to focus, studying everything at the learner's own pace (an
 * exam's after the exam), and "Not now", which leaves the suggestion out until the Plan opens
 * again.
 */
export function OtherOptions({ onMoveDate }: { onMoveDate: (() => void) | null }) {
  const t = useExtracted();
  const canChooseFocus = useCanChooseFocus();
  const chooseFocus = useChooseFocus();
  const studyEverything = useStudyEverything();
  const course = useFullCourse();
  const { dismiss } = usePlanSuggestionSlot();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<SuggestionAction variant="outline" />}>
        {t("Other options")}
        <ChevronDownIcon aria-hidden="true" data-icon="inline-end" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        {onMoveDate && (
          <DropdownMenuItem onClick={onMoveDate}>
            {t("Move your date to cover everything")}
          </DropdownMenuItem>
        )}
        {canChooseFocus && (
          <DropdownMenuItem onClick={chooseFocus}>{t("Choose where to focus")}</DropdownMenuItem>
        )}
        {course && !course.on && (
          <DropdownMenuItem onClick={() => studyEverything(course)}>
            {course.isExam ? t("Study everything after the exam") : t("Study everything")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => dismiss("coverage")}>{t("Not now")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
