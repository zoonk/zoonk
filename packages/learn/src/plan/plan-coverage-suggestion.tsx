"use client";

import { type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";
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
import { usePlanScreen } from "./plan-context";
import { type FindStatus, PendingLabel, useCoveredText, usePlanCoverage } from "./plan-coverage";
import { useFullCourse } from "./plan-full-course";
import {
  CheckingChange,
  type CoverageOffer,
  type Intent,
  OfferPreview,
  OtherOptions,
  getGoalDateMove,
  useAnswerOffer,
  useApplyPreview,
  useCourseOffer,
} from "./plan-offer-preview";
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
import { useStudyEverythingFromSuggestion } from "./study-everything";
import { readTimeToCover, useTimeToCover, useTimeToCoverTexts } from "./use-time-to-cover";

type Coverage = NonNullable<ReturnType<typeof usePlanCoverage>>;

/** Where the card stands once Find asked (see `getCardFlags`). */
type CardFlags = {
  /** Find (or its Try again) leads: nothing found or offered yet. */
  findsTime: boolean;
  /** Moving the date is a way on: a goal whose answer didn't say no date covers it. */
  moveDate: boolean;
  /** Asked for a date, the search found none. */
  noDate: boolean;
  pending: boolean;
  retry: boolean;
  /** No time covers an exam by its date: going on after it leads, as the one way to it all. */
  studiesEverything: boolean;
};

function getCardFlags({
  course,
  found,
  intent,
  isGoal,
  offer,
  status,
}: {
  /** An exam studying everything, offered to end at the exam again. */
  course: boolean;
  found: PlanTimeToCover | null;
  intent: Intent;
  isGoal: boolean;
  offer: CoverageOffer | null;
  status: FindStatus;
}): CardFlags {
  const retry = status === "failed" || status === "building";
  const dateless = isGoal && found !== null && found.fittingDate === null;
  const offersDate = offer?.operations[0]?.kind === "setTargetDate";
  const asked = offer !== null || found !== null;
  const noTime = found !== null && readTimeToCover(found).kind === "none";

  return {
    findsTime: !asked,
    moveDate: isGoal && !course && !dateless && !offersDate,
    noDate: dateless && intent === "date",
    pending: status === "pending",
    retry,
    studiesEverything: !isGoal && !course && noTime,
  };
}

/**
 * What the card says under its title (`description`), and what a screen reader hears when the
 * search ends without an offer to show (`status`): the offer's own lines, that no time covers
 * more, that no date covers everything, or why the search didn't answer.
 */
function useCardLines({
  flags,
  found,
  intent,
  offer,
  title,
}: {
  flags: CardFlags;
  found: PlanTimeToCover | null;
  intent: Intent;
  offer: CoverageOffer | null;
  title: string;
}) {
  const t = useExtracted();
  const texts = useTimeToCoverTexts();
  const { state } = useTimeToCover();
  const failed = intent === "date" ? t("We couldn't check what changes.") : texts.failed;
  const retryText = state.status === "building" ? texts.building : failed;

  const none =
    found?.targetDate && !offer && !flags.noDate
      ? texts.none({
          targetDate: found.targetDate,
          targetDateNamedMonth: found.targetDateNamedMonth,
        })
      : null;

  const noDate = flags.noDate ? texts.noDate : null;
  const retry = flags.retry ? retryText : null;

  return {
    description: [
      ...(offer?.description.filter((line) => line !== title) ?? []),
      ...[none, noDate, retry].filter((line) => line !== null),
    ],
    status: retry ?? noDate ?? none ?? "",
  };
}

/**
 * The card's actions: the offer's diff with Apply once previewed, "Checking what changes…" while a
 * goal's date is found, or Preview, Find (or, once no time covers an exam, "Study everything, even
 * after the exam") and the other ways.
 */
function CoverageBody({
  applying,
  ask,
  flags,
  intent,
  offer,
  onApply,
  onStop,
  preview,
}: {
  applying: boolean;
  ask: (intent: Intent) => void;
  flags: CardFlags;
  intent: Intent;
  offer: CoverageOffer | null;
  onApply: () => void;
  onStop: () => void;
  preview: SlotPreview;
}) {
  const t = useExtracted();
  const texts = useTimeToCoverTexts();
  const coverage = usePlanCoverage();
  const { plan } = usePlanScreen();
  const { requestPreview } = usePlanSuggestionSlot();
  const fullCourse = useFullCourse();
  const studyEverything = useStudyEverythingFromSuggestion();
  const { findsTime, moveDate, pending, retry } = flags;

  if (preview.status !== "idle" && offer) {
    return (
      <OfferPreview
        goalDate={getGoalDateMove({
          operations: offer.operations,
          targetDate: plan.schedule.targetDate,
        })}
        onApply={onApply}
        onRetry={() => void requestPreview(offer.operations)}
        pending={applying}
        preview={preview}
      />
    );
  }

  if (pending && intent === "date") {
    return <CheckingChange onCancel={onStop} />;
  }

  return (
    <SuggestionActions>
      {offer && (
        <SuggestionAction key="preview" onClick={() => void requestPreview(offer.operations)}>
          {t("Preview")}
        </SuggestionAction>
      )}

      {findsTime && (
        <SuggestionAction
          aria-busy={pending || undefined}
          disabled={pending}
          focusableWhenDisabled
          key="find"
          onClick={() => ask(retry ? intent : "time")}
        >
          <PendingLabel pending={pending}>{retry ? texts.tryAgain : texts.find}</PendingLabel>
        </SuggestionAction>
      )}

      {/* Keyed as Find, so the button Find was pressed on becomes it and keeps the keyboard. */}
      {flags.studiesEverything && fullCourse && (
        <SuggestionAction key="find" onClick={() => studyEverything(fullCourse)}>
          {t("Study everything, even after the exam")}
        </SuggestionAction>
      )}

      {coverage && (
        <OtherOptions
          onMoveDate={moveDate ? () => ask("date") : null}
          studyEverythingLeads={flags.studiesEverything && fullCourse !== null}
        />
      )}
    </SuggestionActions>
  );
}

/**
 * The plan's coverage as the slot's suggestion. Its title is what the learner's own time covers,
 * exactly; "Find the time that covers everything" plans the goal at each daily time when they ask
 * (never for the page) and, with one tap, shows what the change it found moves, as a diff (see
 * `useAnswerOffer`); Apply saves it, and the slot says "Plan updated" with what it did and Undo,
 * in the same place, even once the plan covers everything (`coverage` null). A goal's menu moves
 * its date the same way. When no time covers an exam by its date, studying everything, even after
 * it, leads instead, in its sheet. An exam studying everything is offered the exam's end again.
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
  const answered = found && coverage ? answerOffer({ covered, intent, time: found }) : null;
  const offer = courseOffer ?? answered;
  const item: SlotItem = { key: "coverage", kind: "coverage" };
  const answer = useSlotAnswer(item);
  const done = useSlotAnswered(item);
  const { apply, failed, isPending } = useApplyPreview(item);
  const title = offer?.title ?? covered;

  const flags = getCardFlags({
    course: courseOffer !== null,
    found,
    intent,
    isGoal: goal.kind !== "exam",
    offer,
    status: finder.state.status,
  });

  const lines = useCardLines({ flags, found, intent, offer, title });

  const preview = currentPlanPreview({
    operations: offer?.operations ?? [],
    plan,
    state: storedPreview,
  });

  /**
   * Finds once for this plan (or reuses its answer, or waits for the search already running), then
   * shows what the change it found moves.
   */
  const ask = async (next: Intent) => {
    asking.current = next;
    setIntent(next);
    setPreview();
    const outcome = await finder.find();
    const time = outcome.status === "answered" ? outcome.time : null;
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

  return (
    <Suggestion answered={done} label={t("Plan suggestion")} mark={answer && <DoneMark />}>
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
            {lines.description.map((line) => (
              <SuggestionDescription key={line}>{line}</SuggestionDescription>
            ))}

            {/* Always there, so that the search runs, and what it couldn't find, is announced. */}
            <p aria-live="polite" className="sr-only">
              {flags.pending ? texts.finding : lines.status}
            </p>

            <CoverageBody
              applying={isPending}
              ask={(next) => void ask(next)}
              flags={flags}
              intent={intent}
              offer={offer}
              onApply={() => apply(preview)}
              onStop={stopAsking}
              preview={preview}
            />

            {failed && (
              <SuggestionError>{t("That didn't work. Try again in a moment.")}</SuggestionError>
            )}
          </>
        )}
      </SlotContent>
    </Suggestion>
  );
}
