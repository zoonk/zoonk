"use client";

import { type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import {
  SuggestionAction,
  SuggestionActions,
  SuggestionDescription,
  SuggestionLinkAction,
} from "../_components/suggestion";
import { useTimeAnswerTexts } from "../_components/time-answer";
import { getLongerTime } from "../_utils/time-answer";
import { usePlanScreen } from "./plan-context";
import { type FindStatus, useCoveredText, usePlanCoverage } from "./plan-coverage";
import { useFocusTestOfferHref, useTakeFocusTestLabel } from "./plan-focus-test";
import { useFullCourse, useKeepStudyingLabel } from "./plan-full-course";
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
  PlanChangeSuggestion,
  type SlotItem,
  type SlotPreview,
  usePlanSuggestionSlot,
} from "./plan-suggestion-context";
import { useStudyEverythingFromSuggestion } from "./study-everything";
import { readTimeToCover, useTimeToCover, useTimeToCoverTexts } from "./use-time-to-cover";

type Coverage = NonNullable<ReturnType<typeof usePlanCoverage>>;

type CardFlags = {
  findsTime: boolean;
  moveDate: boolean;
  noDate: boolean;
  pending: boolean;
  retry: boolean;
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
  const noTime = found !== null && readTimeToCover(found).kind !== "covers";

  return {
    findsTime: !asked,
    moveDate: isGoal && !course && !dateless && !offersDate,
    noDate: dateless && intent === "date",
    pending: status === "pending",
    retry,
    studiesEverything: !isGoal && !course && noTime,
  };
}

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
  const answerTexts = useTimeAnswerTexts();
  const { state } = useTimeToCover();
  const failed = intent === "date" ? t("We couldn't check what changes.") : texts.failed;
  const retryText = state.status === "building" ? texts.building : failed;

  const longer = getLongerTime(found);

  const none =
    found?.targetDate && longer !== undefined && !offer && !flags.noDate
      ? answerTexts.everythingTakes({
          date: { isoDate: found.targetDate, namedMonth: found.targetDateNamedMonth },
          full: longer,
        })
      : null;

  const noDate = flags.noDate ? texts.noDate : null;
  const retry = flags.retry ? retryText : null;
  const finding = flags.pending && intent === "time" ? texts.finding : null;

  return {
    description: offer?.description.filter((line) => line !== title) ?? [],
    status: finding ?? retry ?? noDate ?? none ?? "",
  };
}

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
  const texts = useTimeToCoverTexts();
  const keepStudying = useKeepStudyingLabel();
  const coverage = usePlanCoverage();
  const { plan } = usePlanScreen();
  const { requestPreview } = usePlanSuggestionSlot();
  const fullCourse = useFullCourse();
  const studyEverything = useStudyEverythingFromSuggestion();
  const focusTestHref = useFocusTestOfferHref();
  const takeFocusTest = useTakeFocusTestLabel();
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
      {/* One key for the main action in every state, so the button pressed keeps the keyboard. */}
      {offer && (
        <SuggestionAction action={() => void requestPreview(offer.operations)} key="find">
          {texts.seeChanges}
        </SuggestionAction>
      )}

      {findsTime && (
        <SuggestionAction action={() => ask(retry ? intent : "time")} busy={pending} key="find">
          {retry ? texts.tryAgain : texts.seeChanges}
        </SuggestionAction>
      )}

      {flags.studiesEverything && fullCourse && (
        <SuggestionAction action={() => studyEverything(fullCourse)} key="find">
          {keepStudying}
        </SuggestionAction>
      )}

      {focusTestHref && (
        <SuggestionLinkAction href={focusTestHref} variant="outline">
          {takeFocusTest}
        </SuggestionLinkAction>
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

export function CoverageSuggestion({ coverage }: { coverage: Coverage | null }) {
  const coveredText = useCoveredText();
  const courseOffer = useCourseOffer();
  const answerOffer = useAnswerOffer();
  const { goal, plan } = usePlanScreen();
  const finder = useTimeToCover();
  const { preview: storedPreview, requestPreview, setPreview } = usePlanSuggestionSlot();
  const [intent, setIntent] = useState<Intent>("time");
  const asking = useRef<Intent | null>(null);
  const covered = coverage ? coveredText(coverage) : "";
  const found = finder.answered;
  const answered = found && coverage ? answerOffer({ covered, intent, time: found }) : null;
  const offer = courseOffer ?? answered;
  const item: SlotItem = { key: "coverage", kind: "coverage" };
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

  return (
    // On a phone the tap on "View" asks for the time, so the sheet names it. A computer shows the
    // panel with no tap, and finding the time plans the goal many times: there the button asks.
    <PlanChangeSuggestion
      failed={failed}
      item={item}
      onOpen={() => void finder.find()}
      summary={covered}
      title={title}
    >
      {lines.description.map((line) => (
        <SuggestionDescription key={line}>{line}</SuggestionDescription>
      ))}

      {/* Seen here, heard from the live line under it: said once. */}
      {lines.status && (
        <SuggestionDescription aria-hidden="true">{lines.status}</SuggestionDescription>
      )}

      {/* Always there, so that the search runs, and what it couldn't find, is announced. */}
      <p aria-live="polite" className="sr-only">
        {lines.status}
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
    </PlanChangeSuggestion>
  );
}
