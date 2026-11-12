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
    activeGoals: t(
      "That's all the goals you can study at once without Plus. Pause one to start another.",
    ),
    dailyExplanations: t("No more quick explanations today. More tomorrow, or now with Plus."),
    dailyGoals: t("No more new goals today. More tomorrow."),
    guest: t("Without an account, you study one goal. Create a free account to start another."),
    monthlyExplanations: t(
      "No more quick explanations this month. More next month, or now with Plus.",
    ),
    monthlyGoals: t("No more new goals this month. More next month, or now with Plus."),
    signUpRequired: t("This needs a free account."),
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
      return { message: t("No more new goals today without an account."), needsAccount: true };
    }

    if (tier === "plus") {
      return { message: t("No more new goals today. More tomorrow."), needsAccount: false };
    }

    return {
      message:
        period === "month"
          ? t("No more new goals this month. More next month, or now with Plus.")
          : t("No more new goals today. More tomorrow, or now with Plus."),
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
