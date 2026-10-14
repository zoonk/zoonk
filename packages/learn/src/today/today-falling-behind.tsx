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
  SuggestionDescription,
  SuggestionError,
  SuggestionHeader,
  SuggestionLine,
  SuggestionLinkAction,
  SuggestionOpen,
  SuggestionResult,
  SuggestionSummary,
} from "../_components/suggestion";
import { useFormatShare } from "../_utils/percent";
import { useFormatDuration } from "../_utils/time-format";
import { useLearnAnalytics } from "../learn-context";
import { useFittingDateText } from "../plan/plan-coverage";
import { useAppliedLine } from "../plan/use-change-sentence";
import { MovedTopicsLine } from "./moved-topics-line";
import { useTodayScreen } from "./today-context";
import { isWelcomeBackDay } from "./use-today-copy";

type Change = NonNullable<TodayView["planChange"]>;
type Behind = NonNullable<PlanChangeView["behind"]>;
type Answer = { applied: PlanChangeView } | { kept: true } | { failed: true } | null;
type Choice = "keep" | "moreTime" | "moveDate";
type Option = Choice | "focus" | "studyEverything";

/** The topics the card names before counting the rest: its sentence already holds the numbers. */
const NAMED_TOPICS = 2;

/**
 * "At 2 hr a day, your plan now covers 39% of the exam, down from 48%.": what the missed days did,
 * in one sentence. What each choice covers goes on the choice itself, so the card never reads
 * three percentages in a row.
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
 * "Study 4 hr a day · about 64%": more time a day with what it covers by the date, the same share
 * the Plan says for it; "everything in depth" when that time covers it all.
 */
function useMoreTimeLabel() {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const formatDuration = useFormatDuration();

  return ({
    dailyMinutes,
    maximumShare,
  }: {
    dailyMinutes: number;
    maximumShare: number | null;
  }) => {
    const time = formatDuration(dailyMinutes);

    return maximumShare === null
      ? t("Study {time} a day · everything in depth", { time })
      : t("Study {time} a day · about {share}", { share: formatShare(maximumShare), time });
  };
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
      order: ["focus", "keep", "moveDate", "moreTime", "studyEverything"],
      primary: behind.canFocus ? "focus" : null,
    };
  }

  const order: Option[] = ["moveDate", "moreTime", "focus", "studyEverything", "keep"];

  if (behind.fittingDate) {
    return { order, primary: "moveDate" };
  }

  return { order, primary: behind.dailyMinutes === null ? null : "moreTime" };
}

/**
 * The choices falling behind leaves, as buttons and links in `getOptionOrder`'s order: the date
 * their time covers it all by, more time a day, where to focus, everything with less depth, or
 * keeping their time.
 */
function BehindChoices({
  behind,
  choose,
  isPending,
}: {
  behind: Behind;
  choose: (choice: Choice) => void;
  isPending: boolean;
}) {
  const t = useExtracted();
  const moreTimeLabel = useMoreTimeLabel();
  const { actions, today } = useTodayScreen();
  const { order, primary } = getOptionOrder({ behind, returnDay: isWelcomeBackDay(today.session) });
  const variant = (option: Option) => (option === primary ? "default" : "outline");

  const choiceButton = (choice: Choice, label: string) => (
    <SuggestionAction
      disabled={isPending}
      key={choice}
      onClick={() => choose(choice)}
      variant={variant(choice)}
    >
      {label}
    </SuggestionAction>
  );

  const link = (option: Option, href: string, label: string) => (
    <SuggestionLinkAction href={href} key={option} variant={variant(option)}>
      {label}
    </SuggestionLinkAction>
  );

  const options: Record<Option, ReactNode> = {
    focus: behind.canFocus && link("focus", actions.chooseFocusHref, t("Choose where to focus")),
    keep: choiceButton("keep", t("Keep my time")),
    moreTime:
      behind.dailyMinutes !== null &&
      !behind.fittingDate &&
      choiceButton(
        "moreTime",
        moreTimeLabel({ dailyMinutes: behind.dailyMinutes, maximumShare: behind.maximumShare }),
      ),
    moveDate:
      behind.fittingDate !== null &&
      choiceButton("moveDate", t("Move your date to cover everything")),
    studyEverything:
      !behind.fittingDate &&
      link("studyEverything", actions.studyEverythingHref, t("Study everything")),
  };

  // The main choice leads, so it's the sheet's widest answer and the panel's first.
  const sorted = primary ? [primary, ...order.filter((option) => option !== primary)] : order;

  return <SuggestionActions>{sorted.map((option) => options[option])}</SuggestionActions>;
}

/** What the learner's choice changes in the plan: more time a day, or the date moved; nothing kept. */
function getChoiceOperations({
  behind,
  choice,
}: {
  behind: Behind;
  choice: Choice;
}): Parameters<ReturnType<typeof useTodayScreen>["actions"]["changePlan"]>[0] | null {
  if (choice === "moreTime" && behind.dailyMinutes !== null) {
    return [{ kind: "setDailyMinutes", minutes: behind.dailyMinutes }];
  }

  if (choice === "moveDate" && behind.fittingDate) {
    return [{ kind: "setTargetDate", targetDate: behind.fittingDate }];
  }

  return null;
}

/**
 * Falling behind put the goal's date at risk: Today says in one sentence what the missed days did
 * to what the plan covers, names a few of the topics that no longer fit, and lets the learner
 * choose (D1): more time a day (with what it covers), where to focus, or keeping their time with
 * less depth where it counts least. When no time covers a goal that isn't an exam, the one way to
 * cover it all is the plan notice's: moving the date to the day their time covers it by. Nothing
 * changes until they tap.
 */
export function FallingBehindNotice({ behind, change }: { behind: Behind; change: Change }) {
  const t = useExtracted();
  const analytics = useLearnAnalytics();
  const sentence = useBehindSentence();
  const fittingDateText = useFittingDateText();
  const appliedLine = useAppliedLine();
  const { actions } = useTodayScreen();
  const [answer, setAnswer] = useState<Answer>(null);
  const [isPending, startTransition] = useTransition();
  const answered = answer !== null && !("failed" in answer);

  const choose = (choice: Choice) =>
    startTransition(async () => {
      const operations = getChoiceOperations({ behind, choice });
      const applied = operations ? await safeAsync(() => actions.changePlan(operations)) : null;

      if (applied && !applied.data) {
        setAnswer({ failed: true });
        return;
      }

      const { data: seen } = await safeAsync(() =>
        actions.decidePlanChange({ changeId: change.id, status: "seen" }),
      );

      if (!seen) {
        setAnswer({ failed: true });
        return;
      }

      setAnswer(applied?.data ? { applied: applied.data } : { kept: true });

      analytics.track({
        name: "Plan Edited",
        properties: { change_kind: `today:behind:${choice}` },
      });
    });

  const result =
    answer && "applied" in answer
      ? appliedLine(answer.applied.todaySession)
      : t("Noted. You keep your time, with less depth where it counts least.");

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
        {behind.fittingDate && (
          <SuggestionDescription>
            {fittingDateText({
              dailyMinutes: behind.currentMinutes,
              fittingDate: behind.fittingDate,
            })}
          </SuggestionDescription>
        )}
        <MovedTopicsLine change={change} named={NAMED_TOPICS} />

        {answered ? (
          <SuggestionResult>{result}</SuggestionResult>
        ) : (
          <BehindChoices behind={behind} choose={choose} isPending={isPending} />
        )}

        {answer && "failed" in answer && (
          <SuggestionError>{t("We couldn't save that. Try again.")}</SuggestionError>
        )}
      </SuggestionContent>
    </Suggestion>
  );
}
