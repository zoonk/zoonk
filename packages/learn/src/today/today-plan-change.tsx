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
  SuggestionHeader,
  SuggestionLine,
  SuggestionOpen,
  SuggestionResult,
  SuggestionSaveError,
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
import { getChangeMark } from "./today-change-mark";
import { useTodayChangeSentence, useTodayCountsByDate } from "./today-change-sentence";
import { useTodayScreen } from "./today-context";
import { FallingBehindNotice } from "./today-falling-behind";
import { useShownChange } from "./use-shown-change";

type Change = NonNullable<TodayView["planChange"]>;
type Decision = PlanChangeDecisionInput["status"];
type Answered = { answer: Decision; answered: PlanChangeView };

/**
 * The notice's title, before the sentence that says what the suggestion does. A change the exam's
 * notice brings says so in its own sentence ("The exam notice says…"), so that sentence is the
 * title.
 */
function useChangeTitle() {
  const t = useExtracted();
  return (change: Change): string => (change.source === NOTICE_SOURCE ? "" : t("Plan suggestion"));
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
function useAnsweredText() {
  const t = useExtracted();
  const appliedLine = useAppliedLine();

  return ({ answer, answered }: Answered): string => {
    switch (answer) {
      case "applied":
        return appliedLine(answered.todaySession);
      case "declined":
        return t("Your plan stays as it was.");
      case "undone":
        return t("Undone. Your plan is back as it was.");
      case "seen":
        return t("Noted.");
      default:
        return t("Noted.");
    }
  };
}

/**
 * "Apply" or "Not now" for a suggestion: "Keep mine" for one the exam's notice brings or one that
 * moves the phase dates, since the answer stays; "Use my date anyway" over the exam's official
 * date.
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
  const overridesNotice = change.officialDate !== null;
  // Answering the notice or the phase dates keeps what the learner has, and the answer stays.
  const keepsMine = change.source === NOTICE_SOURCE || change.source === PHASE_DATES_SOURCE;

  return (
    <SuggestionActions>
      {change.canApply && (
        <SuggestionAction disabled={disabled} onClick={() => onAnswer("applied")}>
          {overridesNotice ? t("Use my date anyway") : t("Apply")}
        </SuggestionAction>
      )}

      <SuggestionAction disabled={disabled} onClick={() => onAnswer("declined")} variant="outline">
        {keepsMine && !overridesNotice && t("Keep mine")}
        {overridesNotice && keepOfficialDate(change.examDocument)}
        {!keepsMine && !overridesNotice && t("Not now")}
      </SuggestionAction>
    </SuggestionActions>
  );
}

/**
 * Answers the change in place; the suggestion then says what the answer did. An answer that didn't
 * save keeps the last one on screen (an applied change whose Undo failed stays applied). Undoing an
 * applied suggestion gives the suggestion back (`change`), waiting for an answer as before Apply,
 * even when Today opened on it already applied. The change stays on screen from the answer
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
        setRestored(saved);
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
  const answeredText = useAnsweredText();
  const officialDate = useOfficialDateLine()(change);
  const byDate = useTodayCountsByDate()(change);
  const title = changeTitle(change);
  const summary = sentence(change);
  const result = answered ? answeredText(answered) : null;

  const after = answered && (
    <AfterAnswer answer={answer} isPending={isPending} onNext={onNext} state={answered} />
  );

  return (
    <Suggestion
      answered={answered?.answer ?? false}
      data-slot="today-plan-change"
      focusOnMount={focusOnMount}
      label={t("Suggested change")}
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
        {title && <SuggestionDescription>{summary}</SuggestionDescription>}
        <ProposalEffect byDate={byDate} change={change} />
        {officialDate && <SuggestionDescription>{officialDate}</SuggestionDescription>}

        {result ? (
          <>
            <SuggestionResult>{result}</SuggestionResult>
            {after && <SuggestionActions>{after}</SuggestionActions>}
          </>
        ) : (
          <ChangeActions change={change} disabled={isPending} onAnswer={answer} />
        )}

        {failed && <SuggestionSaveError />}
      </SuggestionContent>
    </Suggestion>
  );
}

/**
 * Today's plan change, the one place to answer it, only when the learner has a say: a suggestion
 * ("Apply" or "Not now", and its undo once applied), or falling behind that puts the date at risk
 * (more time, focus or keep). What the plan does on its own isn't news on Today (see
 * `asksAboutAutomaticChange`).
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
