"use client";

import { safeAsync } from "@zoonk/utils/error";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { type GoalError, needsAccountFor, useGoalLimitMessage } from "../goal-errors";
import { type CreateGoalsOutcome } from "../onboarding-actions";

function useCreateError() {
  const t = useExtracted();
  const limitMessage = useGoalLimitMessage();

  return (outcome: Exclude<CreateGoalsOutcome, { status: "cancelled" | "created" }>) =>
    outcome.status === "limitReached"
      ? limitMessage(outcome.reason)
      : t("We couldn't save your goal. Try again in a moment.");
}

/** A goal made while its screen was hidden (the learner went to another page) opens when they're back on it. */
export function useGoalCreation() {
  const createError = useCreateError();
  const [error, setError] = useState<GoalError | null>(null);
  const [isCreating, startCreating] = useTransition();
  const shown = useRef(false);
  const madeWhileHidden = useRef<(() => void) | null>(null);

  useEffect(() => {
    shown.current = true;
    const open = madeWhileHidden.current;
    madeWhileHidden.current = null;
    open?.();

    return () => {
      shown.current = false;
    };
  }, []);

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
        const open = () => onCreated(outcome.goalId);

        if (shown.current) {
          open();
        } else {
          madeWhileHidden.current = open;
        }

        return;
      }

      if (outcome.status === "cancelled") {
        return;
      }

      setError({
        limit: outcome.status === "limitReached" ? outcome.reason : undefined,
        message: createError(outcome),
        needsAccount: outcome.status === "limitReached" && needsAccountFor(outcome.reason),
      });
    });

  return { clearError: () => setError(null), create, error, isCreating };
}
