"use client";

import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { type TodayView } from "@zoonk/core/view-models/today/get";
import { safeAsync } from "@zoonk/utils/error";
import { CalendarClockIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode, useState, useTransition } from "react";
import {
  Suggestion,
  SuggestionAction,
  SuggestionActions,
  SuggestionContent,
  SuggestionHeader,
  SuggestionLine,
  SuggestionLinkAction,
  SuggestionOpen,
  SuggestionResult,
  SuggestionSaveError,
  SuggestionSummary,
} from "../_components/suggestion";
import { useFormatShare } from "../_utils/percent";
import { useFormatDuration } from "../_utils/time-format";
import { useLearnAnalytics } from "../learn-context";
import { MovedTopicsLine } from "./moved-topics-line";
import { useTodayScreen } from "./today-context";
import { isWelcomeBackDay } from "./use-today-copy";

type Change = NonNullable<TodayView["planChange"]>;
type Behind = NonNullable<PlanChangeView["behind"]>;
type Answer = { kept: true } | { failed: true } | null;
type Option = "adjustTime" | "focus" | "keep" | "studyEverything";

/** The topics the card names before counting the rest: its sentence already holds the numbers. */
const NAMED_TOPICS = 2;

/**
 * "At 2 hr a day, your plan now covers 39% of the exam, down from 48%.": what the missed days did,
 * in one sentence, the card's only numbers: what more time or a later date would cover is worked
 * out in the plan editor, when the learner asks.
 */
function useBehindSentence() {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const formatDuration = useFormatDuration();

  return (behind: Behind): string => {
    const values = {
      after: formatShare(behind.coveredAfter),
      before: formatShare(behind.coveredBefore),
      time: formatDuration(behind.currentMinutes),
    };

    return behind.measure === "exam"
      ? t("At {time} a day, your plan now covers {after} of the exam, down from {before}.", values)
      : t(
          "At {time} a day, your plan now covers {after} of your goal, down from {before}.",
          values,
        );
  };
}

/**
 * The one link to the plan editor's time a day: an exam asks for more time a day; any other goal
 * can also move its date ("More time or a later date"). The editor finds what covers everything
 * when the learner asks.
 */
function useAdjustTimeLabel(): string {
  const t = useExtracted();
  const { today } = useTodayScreen();
  return today.goal.kind === "exam" ? t("More time a day") : t("More time or a later date");
}

/**
 * The choices in order, and the one drawn as the main action. On a return after a break nothing
 * that asks for more hours leads: Rafaela, back after a month, was offered twice her time first.
 */
function getOptionOrder({ behind, returnDay }: { behind: Behind; returnDay: boolean }): {
  order: Option[];
  primary: Option | null;
} {
  if (returnDay) {
    return {
      order: ["focus", "keep", "adjustTime", "studyEverything"],
      primary: behind.canFocus ? "focus" : null,
    };
  }

  return { order: ["adjustTime", "focus", "studyEverything", "keep"], primary: "adjustTime" };
}

/**
 * The choices falling behind leaves, in `getOptionOrder`'s order: more time a day or a later date
 * open the plan editor at the time a day, where the learner finds what covers everything and the
 * time or date they pick shows what it really covers; where to focus and everything with less
 * depth open their sheets; keeping their time is answered here.
 */
function BehindChoices({
  behind,
  isPending,
  keep,
}: {
  behind: Behind;
  isPending: boolean;
  keep: () => void;
}) {
  const t = useExtracted();
  const adjustTimeLabel = useAdjustTimeLabel();
  const { actions, today } = useTodayScreen();
  const { order, primary } = getOptionOrder({ behind, returnDay: isWelcomeBackDay(today.session) });

  const variant = (option: Option) => (option === primary ? "default" : "outline");

  const link = (option: Option, href: string, label: string) => (
    <SuggestionLinkAction href={href} key={option} variant={variant(option)}>
      {label}
    </SuggestionLinkAction>
  );

  const options: Record<Option, ReactNode> = {
    adjustTime: link("adjustTime", actions.adjustTimeHref, adjustTimeLabel),
    focus: behind.canFocus && link("focus", actions.chooseFocusHref, t("Choose where to focus")),
    keep: (
      <SuggestionAction disabled={isPending} key="keep" onClick={keep} variant={variant("keep")}>
        {t("Keep my time")}
      </SuggestionAction>
    ),
    studyEverything: link("studyEverything", actions.studyEverythingHref, t("Study everything")),
  };

  // The main choice leads, so it's the sheet's widest answer and the panel's first.
  const sorted = primary ? [primary, ...order.filter((option) => option !== primary)] : order;

  return <SuggestionActions>{sorted.map((option) => options[option])}</SuggestionActions>;
}

/**
 * Saves that the learner saw the change, once: true when it's saved. One out of date says nothing
 * (Today read itself again, and its copy or the page's other state replaces it) and stays busy
 * until that shows (`superseded`); one that didn't save says so. Either lets go of the notice
 * (`onHold`), since nothing was saved.
 */
function useSeeChange({
  change,
  onAnswer,
  onHold,
}: {
  change: Change;
  onAnswer: (answer: Answer) => void;
  onHold: (held: boolean) => void;
}) {
  const { actions } = useTodayScreen();
  const [seen, setSeen] = useState(false);
  const [superseded, setSuperseded] = useState<Change | null>(null);

  async function see(): Promise<boolean> {
    if (seen) {
      return true;
    }

    const { data } = await safeAsync(() =>
      actions.decidePlanChange({ changeId: change.id, status: "seen" }),
    );

    if (!data || data === "stale") {
      onAnswer(data === "stale" ? null : { failed: true });
      setSuperseded(data === "stale" ? change : null);
      onHold(false);
      return false;
    }

    setSeen(true);
    return true;
  }

  return { see, superseded: superseded === change };
}

/**
 * Falling behind put the goal's date at risk: Today says in one sentence what the missed days did
 * to what the plan covers, names a few of the topics that no longer fit, and lets the learner
 * choose (D1): more time a day, or for a goal that isn't an exam a later date, in the plan editor's
 * time a day, where Find works out exactly what covers everything and the time or date they pick
 * shows what it really covers; where to focus; studying everything; or keeping their time with
 * less depth where it counts least. Nothing changes until they choose.
 */
export function FallingBehindNotice({
  behind,
  change,
  onHold,
}: {
  behind: Behind;
  change: Change;
  /** Keeps it on screen from the learner's choice (see `TodayPlanChange`). */
  onHold: (held: boolean) => void;
}) {
  const t = useExtracted();
  const analytics = useLearnAnalytics();
  const sentence = useBehindSentence();
  const [answer, setAnswer] = useState<Answer>(null);
  const [isPending, startTransition] = useTransition();
  const { see, superseded } = useSeeChange({ change, onAnswer: setAnswer, onHold });
  const answered = answer !== null && !("failed" in answer);

  // Keeping their time changes nothing: the learner's "seen" is their answer.
  const keep = () => {
    onHold(true);

    startTransition(async () => {
      if (!(await see())) {
        return;
      }

      setAnswer({ kept: true });

      analytics.track({ name: "Plan Edited", properties: { change_kind: "today:behind:keep" } });
    });
  };

  const result = t("Noted. You keep your time, with less depth where it counts least.");

  return (
    <Suggestion
      answered={answered}
      data-slot="today-plan-change"
      label={t("Plan change")}
      mark={<CalendarClockIcon />}
    >
      <SuggestionLine>
        {answered ? (
          <SuggestionResult>{result}</SuggestionResult>
        ) : (
          <>
            <SuggestionSummary>{sentence(behind)}</SuggestionSummary>
            <SuggestionOpen />
          </>
        )}
      </SuggestionLine>

      <SuggestionContent>
        <SuggestionHeader>{sentence(behind)}</SuggestionHeader>
        <MovedTopicsLine change={change} named={NAMED_TOPICS} />

        {answered ? (
          <SuggestionResult>{result}</SuggestionResult>
        ) : (
          <BehindChoices behind={behind} isPending={isPending || superseded} keep={keep} />
        )}

        {answer && "failed" in answer && <SuggestionSaveError />}
      </SuggestionContent>
    </Suggestion>
  );
}
