"use server";

import { startGoalWork } from "@/lib/goals/start-goal-work";
import { continueGoalAtNextLevel } from "@zoonk/core/goals/continue-next-level";
import { changeGoalPlan } from "@zoonk/core/plans/change";
import { choosePlanTools } from "@zoonk/core/plans/choose-tools";
import {
  planChangeDecisionInputSchema,
  planChangeInputSchema,
  planToolChoiceInputSchema,
} from "@zoonk/core/plans/contract";
import { decidePlanChange } from "@zoonk/core/plans/decide-change";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { type PlanChangeOutcome } from "@zoonk/learn/journey";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

/**
 * Server Actions take untrusted input, so each one parses it with the same schema the API uses.
 * Core owns ownership checks and revalidates the plan, so the Journey re-renders with the change.
 */
export async function changePlanAction(
  goalId: string,
  operations: unknown,
): Promise<PlanChangeOutcome | null> {
  const input = planChangeInputSchema.safeParse({ operations });

  if (!input.success) {
    return null;
  }

  const result = await changeGoalPlan({ goalId, input: input.data });

  if (result.status === "unchanged") {
    return { reason: result.reason, status: "unchanged" };
  }

  return result.status === "applied" ? { change: result.change, status: "applied" } : null;
}

/** The learner's answer to a change, with the change as it stands after it; null when not saved. */
export async function answerPlanChangeAction(
  goalId: string,
  { changeId, status }: { changeId: string; status: unknown },
): Promise<PlanChangeView | null> {
  const input = planChangeDecisionInputSchema.safeParse({ status });

  if (!input.success) {
    return null;
  }

  const result = await decidePlanChange({ changeId, goalId, input: input.data });
  return result.status === "updated" ? result.change : null;
}

export async function decidePlanChangeAction(
  goalId: string,
  answer: { changeId: string; status: unknown },
): Promise<boolean> {
  return (await answerPlanChangeAction(goalId, answer)) !== null;
}

/**
 * Setting a tool up can write its setup lesson's outline with a model first, so a failed call
 * comes back as "didn't work" for the card to say, instead of an error screen.
 */
export async function choosePlanToolsAction(goalId: string, input: unknown): Promise<boolean> {
  const parsed = planToolChoiceInputSchema.safeParse(input);

  if (!parsed.success) {
    return false;
  }

  const { data: result, error } = await safeAsync(() =>
    choosePlanTools({ goalId, input: parsed.data }),
  );

  return !error && result.status === "applied";
}

/**
 * "Continue at Beginner" once the plan is done: core completes the finished goal and creates the
 * next level's goal in its place, then its research and curriculum start on the API, as
 * `POST /v1/goals/{goalId}/next-level` does.
 */
export async function continueNextLevelAction(goalId: string): Promise<boolean> {
  const { data, error } = await safeAsync(() => continueGoalAtNextLevel(goalId));

  if (error) {
    logError("[continueNextLevelAction] Failed to continue at the next level:", error);
    return false;
  }

  if (data.status !== "created") {
    return false;
  }

  await startGoalWork([data.goal]);
  return true;
}
