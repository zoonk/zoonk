"use client";

import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";
import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { useExtracted } from "next-intl";
import { SuggestionAction, SuggestionActions } from "../_components/suggestion";
import { SuggestionMenu } from "../_components/suggestion-menu";
import { useTimeAnswerTexts } from "../_components/time-answer";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { type GoalDateMove } from "../plan-diff/change-names";
import { PlanEffectDiff, PlanEffectNote } from "../plan-diff/plan-effect-diff";
import { usePlanScreen } from "./plan-context";
import { useCanChooseFocus, useChooseFocus } from "./plan-focus";
import { useFullCourse, useFullCourseText, useKeepStudyingLabel } from "./plan-full-course";
import { type SlotItem, type SlotPreview, usePlanSuggestionSlot } from "./plan-suggestion-context";
import { useStudyEverythingFromSuggestion } from "./study-everything";
import { usePlanChangeSentence, usePlanDateKind } from "./use-change-sentence";
import { usePlanChange } from "./use-plan-change";
import { readTimeToCover } from "./use-time-to-cover";

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
 * In the aside's narrow card a consequence often takes two lines, so the card keeps that room
 * through the check: its buttons stay where the pointer is when the changes arrive.
 */
const EFFECT_ROOM_CLASS = "in-data-[slot=suggestion-panel]:min-h-16";

export function useApplyPreview(item: SlotItem) {
  const t = useExtracted();
  const sentence = usePlanChangeSentence();
  const { change, isPending } = usePlanChange();
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

  return { apply, isPending };
}

export function OfferPreview({
  goalDate,
  onApply,
  onRetry,
  pending,
  preview,
  repriced = false,
}: {
  goalDate?: GoalDateMove;
  onApply: () => void;
  onRetry: () => void;
  pending: boolean;
  preview: SlotPreview;
  /** The card showed other numbers before this check. */
  repriced?: boolean;
}) {
  const t = useExtracted();
  const dateKind = usePlanDateKind();
  const { setPreview } = usePlanSuggestionSlot();

  if (preview.status === "loading") {
    return <CheckingChange onCancel={() => setPreview()} />;
  }

  if (preview.status === "failed") {
    return (
      <>
        <PlanEffectNote className={EFFECT_ROOM_CLASS}>
          {t("We couldn't check what changes.")}
        </PlanEffectNote>
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

  const { effect, unchanged } = preview.preview;

  return (
    <>
      {unchanged ? (
        <PlanEffectNote className={EFFECT_ROOM_CLASS}>
          {t("Your plan stays as it is.")}
        </PlanEffectNote>
      ) : (
        <PlanEffectDiff
          className={EFFECT_ROOM_CLASS}
          dateKind={dateKind}
          effect={effect}
          goalDate={goalDate}
          repriced={repriced}
        />
      )}

      <SuggestionActions>
        {/* Never applied before its effect is worked out, as Today's proposals. */}
        {!unchanged && effect !== null && (
          <SuggestionAction action={onApply} busy={pending}>
            {t("Change my plan")}
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
 * The button the check leads to holds its place, off, so no button moves or changes size when the
 * check ends. Keyed, so a focused Try again never turns into the button beside it.
 */
function CheckingActions({ onCancel }: { onCancel: () => void }) {
  const t = useExtracted();

  return (
    <SuggestionActions>
      <SuggestionAction disabled key="apply">
        {t("Change my plan")}
      </SuggestionAction>
      <SuggestionAction key="not-now" onClick={onCancel} variant="outline">
        {t("Not now")}
      </SuggestionAction>
    </SuggestionActions>
  );
}

export function CheckingChange({ onCancel }: { onCancel: () => void }) {
  const t = useExtracted();

  return (
    <>
      <PlanEffectNote busy className={EFFECT_ROOM_CLASS}>
        {t("Checking what changes…")}
      </PlanEffectNote>
      <CheckingActions onCancel={onCancel} />
    </>
  );
}

export type CoverageOffer = {
  description: string[];
  operations: LearnerPlanOperation[];
  title: string;
};

export type Intent = "date" | "time";

export function useAnswerOffer() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const formatDate = useFormatIsoDate();
  const answerTexts = useTimeAnswerTexts();
  const { goal, plan } = usePlanScreen();

  return function answerOffer({
    covered,
    intent,
    time,
  }: {
    covered: string;
    intent: Intent;
    time: PlanTimeToCover;
  }): CoverageOffer | null {
    const answer = readTimeToCover(time);
    const { fittingDate } = time;

    if (goal.kind !== "exam" && fittingDate && (intent === "date" || answer.kind !== "covers")) {
      const date = formatDate(fittingDate, "long");

      return {
        description: [covered],
        operations: [{ kind: "setTargetDate", targetDate: fittingDate }],
        title: t({
          description:
            'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
          message:
            "{dateKind, select, month {Your time covers everything by {date}} other {Your time covers everything by {date}}}",
          values: { date, dateKind: "day" },
        }),
      };
    }

    if (intent === "date" || answer.kind === "none") {
      return null;
    }

    if (answer.kind === "focus") {
      // A learner who already studies longer is never asked to cut down: what everything takes is said instead.
      return answer.minutes > plan.schedule.dailyMinutes
        ? {
            description: [
              answerTexts.timeCovers({
                exam: goal.kind === "exam",
                minutes: answer.minutes,
                value: answer.coveredShare,
              }),
            ],
            operations: [{ kind: "setDailyMinutes", minutes: answer.minutes }],
            title: answerTexts.suggestTitle(answer.minutes),
          }
        : null;
    }

    return {
      description: [covered],
      operations: [{ kind: "setDailyMinutes", minutes: answer.minutes }],
      title: t("{time} a day covers everything", { time: formatDuration(answer.minutes) }),
    };
  };
}

export function useCourseOffer(): CoverageOffer | null {
  const course = useFullCourse();
  const text = useFullCourseText();
  const keepStudying = useKeepStudyingLabel();

  if (!course?.on) {
    return null;
  }

  return {
    description: [],
    operations: course.operations(false),
    title: text.finish(course) ?? keepStudying,
  };
}

export function OtherOptions({
  onMoveDate,
  studyEverythingLeads,
}: {
  onMoveDate: (() => void) | null;
  studyEverythingLeads: boolean;
}) {
  const t = useExtracted();
  const canChooseFocus = useCanChooseFocus();
  const chooseFocus = useChooseFocus();
  const studyEverything = useStudyEverythingFromSuggestion();
  const course = useFullCourse();
  const keepStudying = useKeepStudyingLabel();
  const { dismiss } = usePlanSuggestionSlot();

  return (
    <SuggestionMenu>
      {onMoveDate && (
        <DropdownMenuItem onClick={onMoveDate}>
          {t("Move your date to cover everything")}
        </DropdownMenuItem>
      )}
      {canChooseFocus && (
        <DropdownMenuItem onClick={chooseFocus}>{t("Choose where to focus")}</DropdownMenuItem>
      )}
      {course && !course.on && !studyEverythingLeads && (
        <DropdownMenuItem onClick={() => studyEverything(course)}>
          {course.isExam ? keepStudying : t("Study everything")}
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onClick={() => dismiss("coverage")}>{t("Not now")}</DropdownMenuItem>
    </SuggestionMenu>
  );
}
