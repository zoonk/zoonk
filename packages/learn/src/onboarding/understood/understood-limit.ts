"use client";

import { isPlusGoalLimit } from "../entry/goal-limit-notice";
import { type GoalError, useGoalLimitMessage } from "../goal-errors";
import { type GoalLimitReason } from "../onboarding-actions";
import { type UnderstandingDraft } from "./understanding-draft";

/** The draft's own room decides whether the goals followed are full: an up-front notice can be older. */
function findPlusLimit({
  draft,
  error,
  goalLimit,
  hasAccount,
}: {
  draft: UnderstandingDraft;
  error: GoalError | null;
  goalLimit: GoalLimitReason | null;
  hasAccount: boolean;
}): GoalLimitReason | null {
  if (error?.limit && isPlusGoalLimit(error.limit)) {
    return error.limit;
  }

  if (draft.goals.length === 0 && hasAccount) {
    return "activeGoals";
  }

  return goalLimit && goalLimit !== "activeGoals" && isPlusGoalLimit(goalLimit) ? goalLimit : null;
}

/** A full card's way on is a free account for a guest, which has room, and a pause or Plus for an account. */
export function useCardLimit({
  draft,
  error,
  goalLimit,
  hasAccount,
}: {
  draft: UnderstandingDraft;
  error: GoalError | null;
  goalLimit: GoalLimitReason | null;
  hasAccount: boolean;
}): { cardError: GoalError | null; plusLimit: GoalLimitReason | null } {
  const goalLimitMessage = useGoalLimitMessage();

  const cardError: GoalError | null =
    draft.goals.length === 0 && !hasAccount
      ? { limit: "guest", message: goalLimitMessage("guest"), needsAccount: true }
      : error;

  return {
    cardError,
    plusLimit: findPlusLimit({ draft, error: cardError, goalLimit, hasAccount }),
  };
}
