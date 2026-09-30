"use server";

import { changeGoalPlan } from "@zoonk/core/plans/change";
import { choosePlanTools } from "@zoonk/core/plans/choose-tools";
import {
  planChangeDecisionInputSchema,
  planChangeInputSchema,
  planEditRequestInputSchema,
  planToolChoiceInputSchema,
} from "@zoonk/core/plans/contract";
import { decidePlanChange } from "@zoonk/core/plans/decide-change";
import { changeOwnLevel } from "@zoonk/core/plans/own-level";
import {
  type OwnLevelChange,
  ownLevelChangeInputSchema,
} from "@zoonk/core/plans/own-level-contract";
import { type PlanEditRequestResult, requestPlanEdit } from "@zoonk/core/plans/request-edit";
import { type PlanEditOutcome } from "@zoonk/learn/plan";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

/**
 * Server Actions take untrusted input, so each one parses it with the same schema the API uses.
 * Core owns ownership checks and revalidates the plan, so the Plan tab re-renders with the change.
 */
export async function changePlanAction(goalId: string, operations: unknown): Promise<boolean> {
  const input = planChangeInputSchema.safeParse({ operations });

  if (!input.success) {
    return false;
  }

  const result = await changeGoalPlan({ goalId, input: input.data });
  return result.status === "applied";
}

export async function decidePlanChangeAction(
  goalId: string,
  { changeId, status }: { changeId: string; status: unknown },
): Promise<boolean> {
  const input = planChangeDecisionInputSchema.safeParse({ status });

  if (!input.success) {
    return false;
  }

  const result = await decidePlanChange({ changeId, goalId, input: input.data });
  return result.status === "updated";
}

/** What the plan screen says: the change, or why today's small AI help didn't read the words. */
function toEditOutcome(result: PlanEditRequestResult): PlanEditOutcome {
  if (result.status === "limitReached") {
    return { status: "limitReached", tier: result.limit.tier };
  }

  if (result.status === "slowDown") {
    return { retryAfterSeconds: result.retryAfterSeconds, status: "slowDown" };
  }

  return result.status === "applied" ||
    result.status === "proposed" ||
    result.status === "notUnderstood"
    ? { status: result.status }
    : { status: "failed" };
}

/**
 * Reading the words calls a model, so a failed call comes back as "didn't work" for the screen to
 * say, instead of an error screen.
 */
export async function requestPlanEditAction(
  goalId: string,
  text: unknown,
): Promise<PlanEditOutcome> {
  const input = planEditRequestInputSchema.safeParse({ text });

  if (!input.success) {
    return { status: "failed" };
  }

  const { data: result, error } = await safeAsync(() =>
    requestPlanEdit({ goalId, input: input.data }),
  );

  if (error) {
    logError("[requestPlanEditAction] Failed to edit a plan from words:", error);
    return { status: "failed" };
  }

  return toEditOutcome(result);
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

/** Changing your own level: a lower one adds foundations with an undo, a higher one offers test-outs. */
export async function changeOwnLevelAction(
  goalId: string,
  level: unknown,
): Promise<OwnLevelChange | null> {
  const input = ownLevelChangeInputSchema.safeParse({ level });

  if (!input.success) {
    return null;
  }

  const result = await changeOwnLevel({ goalId, input: input.data });
  return result.status === "ready" ? result.ownLevel : null;
}
