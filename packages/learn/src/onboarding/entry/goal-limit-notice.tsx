"use client";

import { useExtracted } from "next-intl";
import { PlusNotice } from "../../_components/plus-lock";
import { useGoalLimitMessage } from "../goal-errors";
import { type GoalLimitReason } from "../onboarding-actions";

/** The goal limits Plus lifts: the free plan's one goal at a time, and its goals for the month. */
export function isPlusGoalLimit(reason: GoalLimitReason): boolean {
  return reason === "oneActiveGoal" || reason === "monthlyGoals";
}

/**
 * A goal limit Plus lifts, as the one Plus notice: up front where goals start (`upFront`, before
 * anything is typed, while quick questions still work), and the same notice when a goal is
 * refused, staying until the learner moves on. Nothing for a limit Plus doesn't lift.
 */
export function GoalLimitNotice({
  reason,
  upFront = false,
}: {
  reason: GoalLimitReason;
  upFront?: boolean;
}) {
  const t = useExtracted();
  const message = useGoalLimitMessage();

  if (!isPlusGoalLimit(reason)) {
    return null;
  }

  if (reason !== "oneActiveGoal") {
    return <PlusNotice>{message(reason)}</PlusNotice>;
  }

  return (
    <PlusNotice title={t("More goals at once with Plus")}>
      {upFront
        ? t(
            "The free plan follows one goal at a time. To start another, pause your current goal from the menu on Journey. Quick questions work anytime.",
          )
        : message(reason)}
    </PlusNotice>
  );
}
