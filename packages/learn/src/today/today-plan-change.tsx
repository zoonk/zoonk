"use client";

import { NOTICE_SOURCE, PHASE_DATES_SOURCE } from "@zoonk/core/plans/change-contract";
import { type PlanChangeDecisionInput } from "@zoonk/core/plans/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { type TodayView } from "@zoonk/core/view-models/today/get";
import { safeAsync } from "@zoonk/utils/error";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import {
  Suggestion,
  SuggestionAction,
  SuggestionActions,
  SuggestionContent,
  SuggestionDescription,
  SuggestionError,
  SuggestionHeader,
  SuggestionLine,
  SuggestionOpen,
  SuggestionResult,
  SuggestionSummary,
} from "../_components/suggestion";
import { useLearnAnalytics } from "../learn-context";
import { PlanEffectDiff } from "../plan-diff/plan-effect-diff";
import {
  useAppliedLine,
  useKeepOfficialDateLabel,
  useOfficialDateLine,
} from "../plan/use-change-sentence";
import { useProposalEffectText } from "../plan/use-effect-text";
import { ListeningBasicsLine, MovedTopicsLines } from "./moved-topics-line";
import { getChangeMark } from "./today-change-mark";
import { useTodayChangeSentence, useTodayCountsByDate } from "./today-change-sentence";
import { useTodayScreen } from "./today-context";
import { FallingBehindNotice } from "./today-falling-behind";
import { AdjustPlanLink } from "./today-plan-change-actions";
import { useShownChange } from "./use-shown-change";

type Change = NonNullable<TodayView["planChange"]>;
type Decision = PlanChangeDecisionInput["status"];
type Answered = { answer: Decision; answered: PlanChangeView };

/**
 * The notice's title: what kind of change it is, before the sentence that says what it does. A
 * change the exam's notice brings says so in its own sentence ("The exam notice says…"), so that
 * sentence is the title.
 */
function useChangeTitle() {
  const t = useExtracted();

  return (change: Change): string => {
    if (change.source === NOTICE_SOURCE) {
      return "";
    }

    if (change.status === "proposed") {
      return t("Plan suggestion");
    }

    if (change.kind === "testedOut") {
      return t("Lessons skipped");
    }

    return t("Your plan changed");
  };
}

/**
 * What a change does to the plan, in words over its diff: what the diff can't say (the lessons it
 * leaves out by name, the topics, its end as the Plan says it), then the diff, which leads with the
 * lessons it leaves out or adds (fewer or more of them without a date they count against,
 * `byDate`). Today's other notices that change the plan say it the same way.
 */
export function ProposalEffect({
  byDate = true,
  change,
}: {
  byDate?: boolean;
  change: Pick<PlanChangeView, "effect">;
}) {
  const proposalEffectText = useProposalEffectText();
  const { planEnd, today } = useTodayScreen();
  const targetDate = today.goal.targetDate?.toISOString().slice(0, "YYYY-MM-DD".length) ?? null;

  const effect = proposalEffectText(
    change,
    { endDate: planEnd, targetDate },
    { besideDiff: true, byDate },
  );

  return (
    <>
      {effect && <SuggestionDescription>{effect}</SuggestionDescription>}
      <PlanEffectDiff byDate={byDate} effect={change.effect} />
    </>
  );
}

/** What the answer did, said where the buttons were: an applied change says what it did to today. */
function useAnsweredText(change: Change) {
  const t = useExtracted();
  const appliedLine = useAppliedLine();

  return ({ answer, answered }: Answered): string => {
    switch (answer) {
      case "applied":
        return appliedLine(answered.todaySession);
      case "declined":
        return t("Your plan stays as it was.");
      case "undone":
        return change.kind === "testedOut"
          ? t("The lessons are back in your plan.")
          : t("Undone. Your plan is back as it was.");
      case "seen":
        return t("Noted.");
      default:
        return t("Noted.");
    }
  };
}

/**
 * "Apply" or "Not now" for a proposal ("Keep mine" for one the exam's notice brings or one that
 * moves the phase dates, since the answer stays); "Got it", and "Undo" while it can be, for a
 * change made.
 */
function ChangeActions({
  change,
  disabled,
  onAnswer,
}: {
  change: Change;
  disabled: boolean;
  onAnswer: (answer: Decision) => void;
}) {
  const t = useExtracted();
  const keepOfficialDate = useKeepOfficialDateLabel();
  const proposal = change.status === "proposed";
  const overridesNotice = proposal && change.officialDate !== null;
  // Answering the notice or the phase dates keeps what the learner has, and the answer stays.
  const keepsMine =
    proposal && (change.source === NOTICE_SOURCE || change.source === PHASE_DATES_SOURCE);

  return (
    <SuggestionActions>
      {(!proposal || change.effect !== null) && (
        <SuggestionAction
          disabled={disabled}
          onClick={() => onAnswer(proposal ? "applied" : "seen")}
        >
          {overridesNotice && t("Use my date anyway")}
          {proposal && !overridesNotice && t("Apply")}
          {!proposal && t("Got it")}
        </SuggestionAction>
      )}

      <AdjustPlanLink change={change} />

      {(proposal || change.canUndo) && (
        <SuggestionAction
          disabled={disabled}
          onClick={() => onAnswer(proposal ? "declined" : "undone")}
          variant="outline"
        >
          {keepsMine && !overridesNotice && t("Keep mine")}
          {overridesNotice && keepOfficialDate(change.examDocument)}
          {proposal && !keepsMine && !overridesNotice && t("Not now")}
          {!proposal && t("Undo")}
        </SuggestionAction>
      )}
    </SuggestionActions>
  );
}

/**
 * Answers the change in place; the suggestion then says what the answer did. An answer that didn't
 * save keeps the last one on screen (an applied change whose Undo failed stays applied). Undoing
 * an applied suggestion gives the suggestion back (`change`), waiting for an answer as before
 * Apply, even when Today opened on it already applied: Ana undid resting on Saturdays and read
 * "Undone" with no way back to it until she reloaded. The change stays on screen from the answer
 * (`onHold`) unless nothing was saved. One out of date stays busy until what replaces it shows.
 */
function useAnswer(opened: Change, onHold: (held: boolean) => void) {
  const analytics = useLearnAnalytics();
  const { actions } = useTodayScreen();
  const [answered, setAnswered] = useState<Answered | null>(null);
  const [restored, setRestored] = useState<Change | null>(null);
  const [failed, setFailed] = useState(false);
  const [superseded, setSuperseded] = useState<Change | null>(null);
  const [isPending, startTransition] = useTransition();
  const change = restored ?? opened;

  const answer = (status: Decision) => {
    onHold(true);

    startTransition(async () => {
      const { data: saved } = await safeAsync(() =>
        actions.decidePlanChange({ changeId: change.id, status }),
      );

      // An out-of-date change says nothing: Today read itself again, and its copy (or the page's
      // other state) replaces it.
      if (saved === "stale") {
        setFailed(false);
        setSuperseded(change);
        onHold(false);
        return;
      }

      setFailed(!saved);

      if (!saved) {
        if (answered === null && restored === null) {
          onHold(false);
        }

        return;
      }

      if (saved.status === "proposed") {
        setRestored({ ...saved, chapterTitle: opened.chapterTitle });
        setAnswered(null);
      } else {
        setAnswered({ answer: status, answered: saved });
      }

      if (status === "seen") {
        return;
      }

      const kind =
        change.status === "proposed" && status !== "undone" ? "proposal" : `undo:${change.kind}`;

      analytics.track({ name: "Plan Edited", properties: { change_kind: `today:${kind}` } });
    });
  };

  return { answer, answered, change, failed, isPending: isPending || superseded === change };
}

/**
 * After the answer: "Next suggestion" when another proposal still waits, else Undo while the
 * applied change can still be undone.
 */
function AfterAnswer({
  answer,
  isPending,
  onNext,
  state,
}: {
  answer: (status: Decision) => void;
  isPending: boolean;
  onNext: (() => void) | null;
  state: Answered;
}) {
  const t = useExtracted();

  if (onNext) {
    return (
      <SuggestionAction onClick={onNext} variant="outline">
        {t("Next suggestion")}
      </SuggestionAction>
    );
  }

  if (state.answer === "applied" && state.answered.canUndo) {
    return (
      <SuggestionAction disabled={isPending} onClick={() => answer("undone")} variant="outline">
        {t("Undo")}
      </SuggestionAction>
    );
  }

  return null;
}

function PlanChangeNotice({
  change: opened,
  focusOnMount = false,
  onHold,
  onNext,
}: {
  change: Change;
  /** It replaced the answered one in place, so the keyboard lands on it. */
  focusOnMount?: boolean;
  /** Keeps it on screen from the learner's answer (`useShownChange`). */
  onHold: (held: boolean) => void;
  /** Shows the next proposal still waiting, once this one is answered; null when none waits. */
  onNext: (() => void) | null;
}) {
  const t = useExtracted();
  const sentence = useTodayChangeSentence();
  const changeTitle = useChangeTitle();
  const { answer, answered, change, failed, isPending } = useAnswer(opened, onHold);
  const answeredText = useAnsweredText(change);
  const officialDate = useOfficialDateLine()(change);
  const byDate = useTodayCountsByDate()(change);
  const proposal = change.status === "proposed";
  const title = changeTitle(change);
  const summary = sentence(change);
  const result = answered ? answeredText(answered) : null;

  // A change whose counts net to zero falls back to "Your plan changed.": the title says it already.
  const repeatsTitle = title === t("Your plan changed") && summary === t("Your plan changed.");

  const after = answered && (
    <AfterAnswer answer={answer} isPending={isPending} onNext={onNext} state={answered} />
  );

  return (
    <Suggestion
      answered={answered?.answer ?? false}
      data-slot="today-plan-change"
      focusOnMount={focusOnMount}
      label={proposal ? t("Suggested change") : t("Plan change")}
      mark={getChangeMark(change)}
    >
      <SuggestionLine>
        {result ? (
          <SuggestionResult>{result}</SuggestionResult>
        ) : (
          <SuggestionSummary>{summary}</SuggestionSummary>
        )}
        {result ? after : <SuggestionOpen />}
      </SuggestionLine>

      <SuggestionContent>
        <SuggestionHeader>{title || summary}</SuggestionHeader>
        {title && !repeatsTitle && <SuggestionDescription>{summary}</SuggestionDescription>}
        {change.kind === "testedOut" && <MovedTopicsLines change={change} />}
        <ListeningBasicsLine change={change} />
        {/* A closer estimate names the lessons that no longer fit, as a proposal does. */}
        {proposal || change.kind === "estimateUpdated" ? (
          <ProposalEffect byDate={byDate} change={change} />
        ) : (
          <PlanEffectDiff byDate={byDate} effect={change.effect} />
        )}
        {officialDate && <SuggestionDescription>{officialDate}</SuggestionDescription>}

        {result ? (
          <>
            <SuggestionResult>{result}</SuggestionResult>
            {after && <SuggestionActions>{after}</SuggestionActions>}
          </>
        ) : (
          <ChangeActions change={change} disabled={isPending} onAnswer={answer} />
        )}

        {failed && <SuggestionError>{t("We couldn't save that. Try again.")}</SuggestionError>}
      </SuggestionContent>
    </Suggestion>
  );
}

/**
 * Today's plan change, the one place to answer it: a proposal ("Apply" or "Not now"), falling
 * behind that puts the date at risk (more time, focus or keep), or an automatic change of the last
 * day, such as a rebalance or a test-out ("We skipped 3 lessons of Electric circuits"), with "Got
 * it" and its undo while the plan is still as it left it.
 */
export function TodayPlanChange() {
  const { today } = useTodayScreen();
  const { current: change, hold, showNext, swapped } = useShownChange(today.planChange);

  if (!change) {
    return null;
  }

  if (change.kind === "missedDays" && change.behind) {
    return (
      <FallingBehindNotice behind={change.behind} change={change} key={change.id} onHold={hold} />
    );
  }

  return (
    <PlanChangeNotice
      change={change}
      focusOnMount={swapped}
      key={change.id}
      onHold={hold}
      onNext={showNext}
    />
  );
}
