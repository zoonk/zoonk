"use client";

import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { MAX_DAILY_MINUTES, type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";
import { getWeekShape } from "@zoonk/core/plans/week-shape";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { Spinner } from "@zoonk/ui/components/spinner";
import { ChevronDownIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import { DoneMark } from "../_components/status-mark";
import {
  Suggestion,
  SuggestionAction,
  SuggestionActions,
  SuggestionDescription,
  SuggestionError,
  SuggestionHeader,
  SuggestionLine,
  SuggestionOpen,
  SuggestionResult,
  SuggestionSummary,
} from "../_components/suggestion";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useFormatShare } from "../_utils/percent";
import { useFormatDuration } from "../_utils/time-format";
import { PlanEffectDiff } from "../plan-diff/plan-effect-diff";
import { usePlanScreen } from "./plan-context";
import { useCoveredText, type usePlanCoverage } from "./plan-coverage";
import { useCanChooseFocus, useChooseFocus } from "./plan-focus";
import { useFullCourse, useFullCourseText } from "./plan-full-course";
import { currentPlanPreview } from "./plan-preview-state";
import {
  SlotContent,
  type SlotItem,
  type SlotPreview,
  SlotUndo,
  usePlanSuggestionSlot,
  useSlotAnswer,
  useSlotAnswered,
} from "./plan-suggestion-context";
import { useStudyEverything } from "./study-everything";
import { useChangeSentence } from "./use-change-sentence";
import { usePlanChange } from "./use-plan-change";
import { readTimeToCover, useTimeToCover, useTimeToCoverTexts } from "./use-time-to-cover";

type Coverage = NonNullable<ReturnType<typeof usePlanCoverage>>;

/** The change the suggestion offers, in words and as the operations that make it. */
type CoverageOffer = { description: string[]; operations: LearnerPlanOperation[]; title: string };

/** What the learner asked the card for: the time that covers everything, or a goal's new date. */
type Intent = "date" | "time";

/**
 * The change a find answer offers (see `useTimeToCover`), all of it exact, since it was planned:
 * asked for a date, the earliest one the learner's own time covers everything by; asked for
 * time, the time found, or when no time covers everything, a goal's new date when it has one, or
 * the most time a day with the share it covers. Null when nothing is worth one tap: no time covers
 * more, or no date was found.
 */
function useAnswerOffer() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const formatShare = useFormatShare();
  const formatDate = useFormatIsoDate();
  const texts = useTimeToCoverTexts();
  const { goal } = usePlanScreen();

  return ({
    covered,
    intent,
    time,
  }: {
    /** What the learner's own time covers (see `useCoveredText`). */
    covered: string;
    intent: Intent;
    time: PlanTimeToCover;
  }): CoverageOffer | null => {
    const answer = readTimeToCover(time);
    const { fittingDate } = time;

    const most =
      answer.kind === "more"
        ? texts.more(answer)
        : answer.kind === "none"
          ? texts.none(MAX_DAILY_MINUTES)
          : null;

    if (goal.kind !== "exam" && fittingDate && (intent === "date" || answer.kind !== "covers")) {
      return {
        description: intent === "date" || !most ? [covered] : [covered, most],
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
      title:
        answer.kind === "covers"
          ? t("{time} a day covers everything in depth", { time: formatDuration(answer.minutes) })
          : t("{time} a day covers about {share} in depth", {
              share: formatShare(answer.share),
              time: formatDuration(answer.minutes),
            }),
    };
  };
}

/**
 * What the card offers without asking anything: an exam studying everything can end at the exam
 * again, a change worked out from the plan as it is. Null otherwise: the rest is the learner's to
 * ask for (Find, Move your date).
 */
function useCourseOffer(): CoverageOffer | null {
  const t = useExtracted();
  const course = useFullCourse();
  const text = useFullCourseText();

  if (!course?.on) {
    return null;
  }

  return {
    description: [t("Until the exam, what comes up most comes first.")],
    operations: course.operations(false),
    title: course.endDate
      ? text.finish({ ...course, endDate: course.endDate })
      : t("Every topic, even after the exam, at your own pace."),
  };
}

/**
 * The other ways to change what the plan covers, in one menu: moving a goal's date (unless it's
 * the offer already), choosing where to focus, studying everything at the learner's own pace (an
 * exam's after the exam), and "Not now", which leaves the suggestion out until the Plan opens
 * again.
 */
function OtherOptions({ onMoveDate }: { onMoveDate: (() => void) | null }) {
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

/**
 * The plan's coverage as the slot's suggestion. Its title is what the learner's own time covers,
 * exactly; "Find the time that covers everything" plans the goal at each daily time when they ask
 * (never for the page) and, with one tap, shows what the change it found moves, as a diff (see
 * `useAnswerOffer`); Apply saves it, and the slot says "Plan updated" with what it did and Undo,
 * in the same place, even once the plan covers everything (`coverage` null). A goal's menu moves
 * its date the same way. An exam studying everything is offered the exam's end again instead.
 */
export function CoverageSuggestion({ coverage }: { coverage: Coverage | null }) {
  const t = useExtracted();
  const texts = useTimeToCoverTexts();
  const coveredText = useCoveredText();
  const courseOffer = useCourseOffer();
  const answerOffer = useAnswerOffer();
  const { goal, plan } = usePlanScreen();
  const finder = useTimeToCover();
  const { preview: storedPreview, requestPreview, setPreview } = usePlanSuggestionSlot();
  const [intent, setIntent] = useState<Intent>("time");
  // What the card is asking for, so an answer it stopped waiting for ("Not now") shows nothing.
  const asking = useRef<Intent | null>(null);
  const covered = coverage ? coveredText(coverage) : "";
  const found = finder.answered;
  const offer = courseOffer ?? (found && coverage ? answerOffer({ covered, intent, time: found }) : null);
  const isGoal = goal.kind !== "exam";
  const canFind = !courseOffer && getWeekShape(plan.schedule).weekdays < MAX_DAILY_MINUTES;

  const preview = currentPlanPreview({
    operations: offer?.operations ?? [],
    plan,
    state: storedPreview,
  });

  const item: SlotItem = { key: "coverage", kind: "coverage" };
  const { apply, failed, isPending } = useApplyPreview(item);
  const answer = useSlotAnswer(item);
  const answered = useSlotAnswered(item);
  const title = offer?.title ?? covered;

  /** Finds once for this plan (or reuses its answer), then shows what the change it found moves. */
  const ask = async (next: Intent) => {
    asking.current = next;
    setIntent(next);
    setPreview();
    const time = found ?? (await finder.find());
    const asked = time && coverage ? answerOffer({ covered, intent: next, time }) : null;

    if (asked && asking.current === next) {
      void requestPreview(asked.operations);
    }
  };

  const stopAsking = () => {
    asking.current = null;
    setIntent("time");
  };

  const undo = answer && <SlotUndo item={item} />;
  const { state } = finder;
  const pending = state.status === "pending";
  const retry = state.status === "failed" || state.status === "building";
  const noDate = intent === "date" && found !== null && offer === null;
  const moveDate =
    isGoal && !courseOffer && !noDate && offer?.operations[0]?.kind !== "setTargetDate";
  const other = coverage && <OtherOptions onMoveDate={moveDate ? () => void ask("date") : null} />;

  /** What the card says under its title before its actions. */
  const description = [
    ...(offer?.description.filter((line) => line !== title) ?? []),
    ...(found && !offer && !noDate ? [texts.none(MAX_DAILY_MINUTES)] : []),
    ...(noDate ? [texts.noDate] : []),
    ...(retry ? [state.status === "building" ? texts.building : texts.failed] : []),
  ];

  const body = () => {
    if (preview.status !== "idle" && offer) {
      return (
        <OfferPreview
          goalDate={getGoalDateMove({
            operations: offer.operations,
            targetDate: plan.schedule.targetDate,
          })}
          onApply={() => apply(preview)}
          onRetry={() => void requestPreview(offer.operations)}
          pending={isPending}
          preview={preview}
        />
      );
    }

    if (pending && intent === "date") {
      return <CheckingChange onCancel={stopAsking} />;
    }

    const findAction = (canFind || retry) && !offer && !found && (
      <SuggestionAction
        aria-busy={pending || undefined}
        disabled={pending}
        focusableWhenDisabled
        key="find"
        onClick={() => void ask(retry ? intent : "time")}
      >
        {pending && <Spinner aria-hidden="true" data-icon="inline-start" role="presentation" />}
        {retry ? texts.tryAgain : texts.find}
      </SuggestionAction>
    );

    const leadDate = !findAction && !offer && !found && moveDate && (
      <SuggestionAction key="move" onClick={() => void ask("date")}>
        {t("Move your date to cover everything")}
      </SuggestionAction>
    );

    return (
      <SuggestionActions>
        {offer && (
          <SuggestionAction key="preview" onClick={() => void requestPreview(offer.operations)}>
            {t("Preview")}
          </SuggestionAction>
        )}
        {findAction}
        {leadDate}
        {other}
        {pending && <span className="sr-only">{texts.finding}</span>}
      </SuggestionActions>
    );
  };

  return (
    <Suggestion answered={answered} label={t("Plan suggestion")} mark={answer && <DoneMark />}>
      <SuggestionLine>
        {answer ? (
          <>
            <SuggestionResult>{answer.text}</SuggestionResult>
            {undo}
          </>
        ) : (
          <>
            <SuggestionSummary>{title}</SuggestionSummary>
            <SuggestionOpen />
          </>
        )}
      </SuggestionLine>

      <SlotContent>
        <SuggestionHeader>{answer ? t("Plan updated") : title}</SuggestionHeader>

        {answer ? (
          <>
            <SuggestionResult>{answer.text}</SuggestionResult>
            <SuggestionActions>{undo}</SuggestionActions>
          </>
        ) : (
          <>
            {description.map((line) => (
              <SuggestionDescription key={line} role={retry || noDate ? "status" : undefined}>
                {line}
              </SuggestionDescription>
            ))}

            {body()}

            {failed && (
              <SuggestionError>{t("That didn't work. Try again in a moment.")}</SuggestionError>
            )}
          </>
        )}
      </SlotContent>
    </Suggestion>
  );
}
