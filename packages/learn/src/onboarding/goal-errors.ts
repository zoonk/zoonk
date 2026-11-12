"use client";

import { type EntitlementTier } from "@zoonk/core/entitlements/contract";
import { useExtracted } from "next-intl";
import { type GoalLimitReason, type StartUnderstandingOutcome } from "./onboarding-actions";

/**
 * Its own namespace (`goalErrors`), which apps ship on every page, since a goal starts from public
 * pages too.
 */
export type GoalError = { limit?: GoalLimitReason; message: string; needsAccount: boolean };

const ACCOUNT_REASONS = new Set<GoalLimitReason>(["guest", "signUpRequired"]);

export function needsAccountFor(reason: GoalLimitReason): boolean {
  return ACCOUNT_REASONS.has(reason);
}

export function useGoalLimitMessage() {
  const t = useExtracted("goalErrors");

  const messages: Record<GoalLimitReason, string> = {
    activeGoals: t({
      description:
        "Shown when a free learner tries to start a goal while following as many goals as the free plan allows at once. “Following” a goal means it's active on the learner's plan: this counts goals followed at once, not new goals started per day or month. Pausing a goal keeps its progress. “Plus” is the name of the paid plan, not the word “more”.",
      message:
        "You're following as many goals as the free plan allows. To make room for another, pause one of your goals from the menu on your Plan, or get Plus.",
    }),
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
    signUpRequired: t("Create your free account to continue."),
    slowDown: t("You're starting goals quickly. Try again in a few minutes."),
  };

  return (reason: GoalLimitReason) => messages[reason];
}

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

    if (outcome.status === "signUpRequired") {
      return { message: goalLimitMessage("signUpRequired"), needsAccount: true };
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
