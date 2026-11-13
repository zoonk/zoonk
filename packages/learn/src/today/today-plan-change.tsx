"use client";

import { NOTICE_SOURCE, PHASE_DATES_SOURCE } from "@zoonk/core/plans/change-contract";
import { type PlanChangeDecisionInput } from "@zoonk/core/plans/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { type TodayView } from "@zoonk/core/view-models/today/get";
import { safeAsync } from "@zoonk/utils/error";
import { Undo2Icon } from "lucide-react";
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
  useMainActionVariant,
} from "../_components/suggestion";
import { PlanEffectDiff } from "../plan-diff/plan-effect-diff";
import { useAppliedLine, useOfficialDateLine } from "../plan/use-change-sentence";
import { getChangeMark } from "./today-change-mark";
import {
  useTodayChangeWords,
  useTodayCountsByDate,
  useTodayDateKind,
} from "./today-change-sentence";
import { useTodayScreen } from "./today-context";
import { FallingBehindNotice } from "./today-falling-behind";
import { useShownChange } from "./use-shown-change";

type Change = NonNullable<TodayView["planChange"]>;
type Decision = PlanChangeDecisionInput["status"];
type Answered = { answer: Decision; answered: PlanChangeView };

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
  const overridesNotice = change.officialDate !== null;
  // Answering the notice or the phase dates keeps what the learner has, and the answer stays.
  const keepsMine = change.source === NOTICE_SOURCE || change.source === PHASE_DATES_SOURCE;
  const mainVariant = useMainActionVariant();

  return (
    <SuggestionActions>
      {change.canApply && (
        <SuggestionAction
          action={() => onAnswer("applied")}
          disabled={disabled}
          variant={mainVariant}
        >
          {overridesNotice ? t("Use my date") : t("Change my plan")}
        </SuggestionAction>
      )}

      <SuggestionAction action={() => onAnswer("declined")} disabled={disabled} variant="outline">
        {keepsMine && !overridesNotice && t("Keep mine")}
        {overridesNotice && t("Keep official date")}
        {!keepsMine && !overridesNotice && t("Not now")}
      </SuggestionAction>
    </SuggestionActions>
  );
}

function useAnswer(opened: Change, onHold: (held: boolean) => void) {
  const { actions } = useTodayScreen();
  const [answered, setAnswered] = useState<Answered | null>(null);
  const [restored, setRestored] = useState<Change | null>(null);
  const [failed, setFailed] = useState(false);
  const [superseded, setSuperseded] = useState<Change | null>(null);
  const [repriced, setRepriced] = useState(false);
  const [isPending, startTransition] = useTransition();
  const change = restored ?? opened;

  const answer = (status: Decision) => {
    onHold(true);

    startTransition(async () => {
      const { data: saved } = await safeAsync(() =>
        actions.decidePlanChange({ changeId: change.id, status }),
      );

      // An out-of-date change says nothing: Today read itself again, and its copy replaces it.
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

      // Accepted, and still waiting: its numbers moved, so it asks again with today's.
      setRepriced(status === "applied" && saved.status === "proposed");

      if (saved.status === "proposed") {
        setRestored(saved);
        setAnswered(null);
      } else {
        setAnswered({ answer: status, answered: saved });
      }
    });
  };

  return {
    answer,
    answered,
    change,
    failed,
    isPending: isPending || superseded === change,
    repriced,
  };
}

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
      <SuggestionAction
        action={() => answer("undone")}
        busy={isPending}
        icon={<Undo2Icon aria-hidden="true" />}
        variant="outline"
      >
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
  focusOnMount?: boolean;
  onHold: (held: boolean) => void;
  onNext: (() => void) | null;
}) {
  const t = useExtracted();
  const { answer, answered, change, failed, isPending, repriced } = useAnswer(opened, onHold);
  const words = useTodayChangeWords()(change);
  const answeredText = useAnsweredText();
  const officialDate = useOfficialDateLine()(change);
  const byDate = useTodayCountsByDate()(change);
  const dateKind = useTodayDateKind();
  const result = answered ? answeredText(answered) : null;

  const after = answered && (
    <AfterAnswer answer={answer} isPending={isPending} onNext={onNext} state={answered} />
  );

  return (
    <Suggestion
      answered={answered?.answer ?? false}
      data-slot="today-plan-change"
      focusOnMount={focusOnMount}
      label={t("Plan suggestion")}
      mark={getChangeMark(change)}
    >
      <SuggestionLine>
        {result ? (
          <SuggestionResult>{result}</SuggestionResult>
        ) : (
          <SuggestionSummary>{words.title}</SuggestionSummary>
        )}
        {result ? after : <SuggestionOpen />}
      </SuggestionLine>

      <SuggestionContent>
        <SuggestionHeader>{words.title}</SuggestionHeader>
        {words.why && <SuggestionDescription>{words.why}</SuggestionDescription>}
        <PlanEffectDiff
          byDate={byDate}
          dateKind={dateKind}
          effect={change.effect}
          repriced={repriced}
        />
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
 * Only when the learner has a say: what the plan does on its own isn't news on Today
 * (`asksAboutAutomaticChange`).
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
