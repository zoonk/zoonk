"use client";

import { type EntitlementTier } from "@zoonk/core/entitlements/contract";
import { useExtracted } from "next-intl";
import { type GoalLimitReason, type StartUnderstandingOutcome } from "./onboarding-actions";

/**
 * Why a goal couldn't be read or created, as the screen says it. These messages live in their
 * own namespace (`goalErrors`), which apps ship on every page, because a goal starts from public
 * pages too: the home page's goal box and a course's "Start this course".
 */
export type GoalError = {
  message: string;
  /** A guest's one goal is taken, or their small AI calls for today: an account keeps going. */
  needsAccount: boolean;
};

/** Why a new goal couldn't start: a guest's one goal, the free plan's one, the day's, or haste. */
export function useGoalLimitMessage() {
  const t = useExtracted("goalErrors");

  const messages: Record<GoalLimitReason, string> = {
    dailyExplanations: t(
      "You've asked as many new questions as the free plan allows today. Try again tomorrow, or get Plus to keep going now.",
    ),
    dailyGoals: t(
      "You've started as many new goals as your plan allows today. Try again tomorrow.",
    ),
    guest: t("Without an account, you can follow one goal. Create a free account to keep going."),
    monthlyExplanations: t(
      "You've asked as many new questions as the free plan allows this month. Try again next month, or get Plus to keep going now.",
    ),
    monthlyGoals: t(
      "You've started as many new goals as the free plan allows this month. Try again next month, or get Plus to keep going now.",
    ),
    oneActiveGoal: t(
      "The free plan follows one goal at a time. To start this one, pause your current goal from the goal menu on Today, or get Plus.",
    ),
    slowDown: t("You're starting goals quickly. Try again in a few minutes."),
  };

  return (reason: GoalLimitReason) => messages[reason];
}

/**
 * New words to read count toward the small AI calls of the day and the month: a guest who used
 * them up is asked to create an account (their words stay), a free learner comes back when they
 * start over or gets Plus, and Plus comes back tomorrow.
 */
function useUnderstandingLimit() {
  const t = useExtracted("goalErrors");

  return ({
    period,
    tier,
  }: {
    period: "day" | "month" | "total";
    tier: EntitlementTier;
  }): GoalError => {
    if (tier === "guest") {
      return {
        message: t(
          "Without an account, you can send a few new goals a day. Create a free account to keep going.",
        ),
        needsAccount: true,
      };
    }

    if (tier === "plus") {
      return {
        message: t("You've sent as many new goals as your plan allows today. Try again tomorrow."),
        needsAccount: false,
      };
    }

    return {
      message:
        period === "month"
          ? t(
              "You've sent as many new goals as the free plan allows this month. Try again next month, or get Plus to keep going now.",
            )
          : t(
              "You've sent as many new goals as the free plan allows today. Try again tomorrow, or get Plus to keep going now.",
            ),
      needsAccount: false,
    };
  };
}

/** Why typed words couldn't be sent; the entry keeps them to send again. */
export function useStartError() {
  const t = useExtracted("goalErrors");
  const limitError = useUnderstandingLimit();
  const goalLimitMessage = useGoalLimitMessage();

  return (
    outcome: Exclude<StartUnderstandingOutcome, { status: "started" | "startFailed" }>,
  ): GoalError => {
    if (outcome.status === "limitReached") {
      return limitError(outcome);
    }

    if (outcome.status === "needsAccount") {
      return { message: goalLimitMessage("guest"), needsAccount: true };
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
