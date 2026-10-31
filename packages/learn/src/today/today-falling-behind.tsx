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

const NAMED_TOPICS = 2;

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

function useAdjustTimeLabel(): string {
  const t = useExtracted();
  const { today } = useTodayScreen();
  return today.goal.kind === "exam" ? t("More time a day") : t("More time or a later date");
}

/** On a return after a break, nothing that asks for more hours leads. */
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
        {t({
          description: "Keeps the learner's daily study time as it is.",
          message: "Keep my time",
        })}
      </SuggestionAction>
    ),
    studyEverything: link("studyEverything", actions.studyEverythingHref, t("Study everything")),
  };

  const sorted = primary ? [primary, ...order.filter((option) => option !== primary)] : order;

  return <SuggestionActions>{sorted.map((option) => options[option])}</SuggestionActions>;
}

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

export function FallingBehindNotice({
  behind,
  change,
  onHold,
}: {
  behind: Behind;
  change: Change;
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
