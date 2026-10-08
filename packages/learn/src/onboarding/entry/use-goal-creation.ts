"use client";

import { safeAsync } from "@zoonk/utils/error";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { type GoalError, useGoalLimitMessage } from "../goal-errors";
import { type CreateGoalsOutcome } from "../onboarding-actions";

function useCreateError() {
  const t = useExtracted();
  const limitMessage = useGoalLimitMessage();

  return (outcome: Exclude<CreateGoalsOutcome, { status: "created" }>) =>
    outcome.status === "limitReached"
      ? limitMessage(outcome.reason)
      : t("We couldn't save your goal. Try again in a moment.");
}

/**
 * Creating goals from what was understood: pending while it saves, then on to where the goal
 * continues, or why it couldn't (a goal limit, or a failure) for the screen to say.
 */
export function useGoalCreation() {
  const createError = useCreateError();
  const [error, setError] = useState<GoalError | null>(null);
  const [isCreating, startCreating] = useTransition();

  const create = ({
    onCreated,
    run,
  }: {
    onCreated: (goalId: string) => void;
    run: () => Promise<CreateGoalsOutcome>;
  }) =>
    startCreating(async () => {
      setError(null);
      const { data } = await safeAsync(run);
      const outcome: CreateGoalsOutcome = data ?? { status: "failed" };

      if (outcome.status === "created") {
        onCreated(outcome.goalId);
        return;
      }

      setError({
        message: createError(outcome),
        needsAccount: outcome.status === "limitReached" && outcome.reason === "guest",
      });
    });

  return { clearError: () => setError(null), create, error, isCreating };
}
