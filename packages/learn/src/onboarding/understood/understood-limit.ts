"use client";

import { isPlusGoalLimit } from "../entry/goal-limit-notice";
import { type GoalError, useGoalLimitWords } from "../goal-errors";
import { type GoalLimit } from "../onboarding-actions";
import { type UnderstandingDraft } from "./understanding-draft";

const GUEST = { reason: "guest" } as const;

/** The draft's own room decides whether the goals followed are full: an up-front notice can be older. */
function findPlusLimit({
  draft,
  error,
  goalLimit,
  hasAccount,
}: {
  draft: UnderstandingDraft;
  error: GoalError | null;
  goalLimit: GoalLimit | null;
  hasAccount: boolean;
}): GoalLimit | null {
  if (error?.limit && isPlusGoalLimit(error.limit.reason)) {
    return error.limit;
  }

  if (draft.goals.length === 0 && hasAccount) {
    return { reason: "activeGoals" };
  }

  return goalLimit && goalLimit.reason !== "activeGoals" && isPlusGoalLimit(goalLimit.reason)
    ? goalLimit
    : null;
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
  goalLimit: GoalLimit | null;
  hasAccount: boolean;
}): { cardError: GoalError | null; plusLimit: GoalLimit | null } {
  const goalLimitWords = useGoalLimitWords();

  const cardError: GoalError | null =
    draft.goals.length === 0 && !hasAccount
      ? { limit: GUEST, message: goalLimitWords(GUEST), needsAccount: true }
      : error;

  return {
    cardError,
    plusLimit: findPlusLimit({ draft, error: cardError, goalLimit, hasAccount }),
  };
}
