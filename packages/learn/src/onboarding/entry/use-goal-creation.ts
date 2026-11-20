"use client";

import { type OnboardingDraftView } from "@zoonk/core/view-models/onboarding/contract";
import { safeAsync } from "@zoonk/utils/error";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { type LimitText } from "../../_components/comes-back-words";
import { received } from "../../_components/help-limit-notice";
import { type GoalError, useGoalLimitWords } from "../goal-errors";
import { type CreateGoalsOutcome, needsAccountFor } from "../onboarding-actions";

function useCreateError() {
  const t = useExtracted();
  const limitWords = useGoalLimitWords();

  return (outcome: Exclude<CreateGoalsOutcome, { status: "created" }>): LimitText =>
    outcome.status === "limitReached"
      ? limitWords(outcome)
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
    onLimit,
    run,
  }: {
    onCreated: (goalId: string) => void;
    onLimit?: () => void;
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

      setError({
        limit:
          outcome.status === "limitReached"
            ? received({ availableAt: outcome.availableAt, reason: outcome.reason })
            : undefined,
        message: createError(outcome),
        needsAccount: outcome.status === "limitReached" && needsAccountFor(outcome.reason),
      });

      if (outcome.status === "limitReached") {
        onLimit?.();
      }
    });

  const clearActiveGoalsError = (draft: OnboardingDraftView) => {
    if (draft.activeGoalsLeft !== 0) {
      setError((current) => (current?.limit?.reason === "activeGoals" ? null : current));
    }
  };

  return { clearActiveGoalsError, clearError: () => setError(null), create, error, isCreating };
}
