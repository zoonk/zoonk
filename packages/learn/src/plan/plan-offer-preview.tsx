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
import { useStudyEverythingFromSuggestion } from "./study-everything";
import { useChangeSentence } from "./use-change-sentence";
import { usePlanChange } from "./use-plan-change";
import { readTimeToCover, useTimeToCoverTexts } from "./use-time-to-cover";

type GoalDateMove = { after: string; before: string | null };

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

export function OfferPreview({
  goalDate,
  onApply,
  onRetry,
  pending,
  preview,
}: {
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
          {t({
            description: '"Then" means "with this change".',
            message: "Your plan then covers everything in depth.",
          })}
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
  const texts = useTimeToCoverTexts();
  const { goal } = usePlanScreen();

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
    const { fittingDate, targetDate, targetDateNamedMonth } = time;

    const none =
      answer.kind === "none" && targetDate
        ? texts.none({ targetDate, targetDateNamedMonth })
        : null;

    if (goal.kind !== "exam" && fittingDate && (intent === "date" || answer.kind !== "covers")) {
      return {
        description: intent === "date" || !none ? [covered] : [covered, none],
        operations: [{ kind: "setTargetDate", targetDate: fittingDate }],
        title: t({
          description:
            '{date} is a day, like "May 5", or a month, like "May 2027", when the learner gave only a month.',
          message: "Your time covers everything by {date}",
          values: { date: formatDate(fittingDate, "long") },
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
    title: text.finish(course) ?? t("Study everything, even after the exam"),
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
        {course && !course.on && !studyEverythingLeads && (
          <DropdownMenuItem onClick={() => studyEverything(course)}>
            {course.isExam ? t("Study everything, even after the exam") : t("Study everything")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => dismiss("coverage")}>{t("Not now")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
