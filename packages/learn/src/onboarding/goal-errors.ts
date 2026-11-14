"use client";

import { useExtracted } from "next-intl";
import {
  type CapWords,
  type LimitText,
  toCapWords,
  useLimitText,
} from "../_components/comes-back-words";
import {
  type GoalLimit,
  type StartUnderstandingOutcome,
  type UsageCap,
} from "./onboarding-actions";

/**
 * Its own namespace (`goalErrors`), which apps ship on every page, since a goal starts from public
 * pages too.
 */
export type GoalError = { limit?: GoalLimit; message: LimitText; needsAccount: boolean };

function useNewGoalTitles() {
  const t = useExtracted("goalErrors");

  return {
    day: t("No more new goals today"),
    rolling: t("You've started all the new goals you can"),
  };
}

/**
 * What a goal refused at its start says, as a cap's title and line. Only a free learner meets the
 * caps over the last 30 days; a day's cap on new goals offers no subscription, since Plus has one too.
 */
export function useGoalLimitWords() {
  const t = useExtracted("goalErrors");
  const newGoals = useNewGoalTitles();

  return ({ availableAt = null, reason }: GoalLimit): CapWords => {
    const rolling = { availableAt, period: "rolling30Days", tier: "free" } as const;

    switch (reason) {
      case "activeGoals":
        return {
          line: t("Pause one in your Plan, or subscribe to study more at once."),
          title: t("That's all the goals you can study at once"),
        };
      case "dailyExplanations":
        return {
          cap: { period: "day", tier: "free" },
          title: t("No more quick explanations today"),
        };
      case "dailyGoals":
        return { cap: { period: "day", tier: "plus" }, title: newGoals.day };
      case "guest":
        return {
          line: t(
            "Without an account, you study one goal. Create a free account to start another.",
          ),
        };
      case "monthlyExplanations":
        return { cap: rolling, title: t("You've used your quick explanations") };
      case "monthlyGoals":
        return { cap: rolling, title: newGoals.rolling };
      case "signUpRequired":
        return { line: t("This needs a free account.") };
      case "slowDown":
        return { line: t("You're starting goals quickly. Try again in a few minutes.") };
      default:
        return reason satisfies never;
    }
  };
}

function useUnderstandingLimit() {
  const t = useExtracted("goalErrors");
  const newGoals = useNewGoalTitles();

  return (cap: UsageCap): GoalError =>
    cap.tier === "guest"
      ? { message: t("No more new goals today without an account."), needsAccount: true }
      : {
          message: toCapWords(cap, { day: newGoals.day, rolling: newGoals.rolling }),
          needsAccount: false,
        };
}

export function useStartError() {
  const t = useExtracted("goalErrors");
  const limitError = useUnderstandingLimit();
  const goalLimitWords = useGoalLimitWords();

  return (
    outcome: Exclude<StartUnderstandingOutcome, { status: "started" | "startFailed" }>,
  ): GoalError => {
    if (outcome.status === "limitReached") {
      return limitError(outcome);
    }

    if (outcome.status === "needsAccount") {
      return { message: goalLimitWords({ reason: "guest" }), needsAccount: true };
    }

    if (outcome.status === "signUpRequired") {
      return { message: goalLimitWords({ reason: "signUpRequired" }), needsAccount: true };
    }

    return {
      message:
        outcome.status === "slowDown"
          ? t("One moment. Try again in a few seconds.")
          : t("We couldn't read your goal. Try again in a moment."),
      needsAccount: false,
    };
  };
}

export function useGoalLimitText(limit: GoalLimit | null): string {
  const words = useGoalLimitWords();
  return useLimitText(limit ? words(limit) : null);
}
