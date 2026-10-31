"use server";

import { postAsLearner } from "@/lib/api/learner-api";
import { chooseExamOption } from "@zoonk/core/exams/choices/choose";
import { examChoiceInputSchema } from "@zoonk/core/exams/choices/contract";
import { changeGoalPlan } from "@zoonk/core/plans/change";
import { choosePlanTools } from "@zoonk/core/plans/choose-tools";
import {
  planChangeDecisionInputSchema,
  planChangeInputSchema,
  planToolChoiceInputSchema,
} from "@zoonk/core/plans/contract";
import { decidePlanChange } from "@zoonk/core/plans/decide-change";
import { previewPlanChange } from "@zoonk/core/plans/preview";
import { type PlanChangePreview } from "@zoonk/core/plans/preview-contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { type PlanChangeOutcome } from "@zoonk/learn/journey";
import { safeAsync } from "@zoonk/utils/error";

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

  if (result.status !== "applied") {
    return null;
  }

  return { change: result.change, status: "applied" };
}

/** Nothing is saved, so it's safe to ask while the learner weighs their choice. */
export async function previewPlanChangeAction(
  goalId: string,
  operations: unknown,
): Promise<PlanChangePreview | null> {
  const input = planChangeInputSchema.safeParse({ operations });

  if (!input.success) {
    return null;
  }

  const result = await previewPlanChange({ goalId, input: input.data });
  return result.status === "ready" ? result.preview : null;
}

export async function answerPlanChangeAction(
  goalId: string,
  { changeId, status }: { changeId: string; status: unknown },
): Promise<PlanChangeView | null> {
  const input = planChangeDecisionInputSchema.safeParse({ status });

  if (!input.success) {
    return null;
  }

  const result = await decidePlanChange({ changeId, goalId, input: input.data });

  if (result.status !== "updated") {
    return null;
  }

  return result.change;
}

export async function decidePlanChangeAction(
  goalId: string,
  answer: { changeId: string; status: unknown },
): Promise<boolean> {
  return (await answerPlanChangeAction(goalId, answer)) !== null;
}

/** A tool's setup can call a model first, so a failed call comes back as "didn't work", not an error screen. */
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

export async function chooseExamOptionAction(
  goalId: string,
  input: unknown,
): Promise<{ change: PlanChangeView | null } | null> {
  const parsed = examChoiceInputSchema.safeParse(input);

  if (!parsed.success) {
    return null;
  }

  const result = await chooseExamOption({ goalId, input: parsed.data });

  return result.status === "applied" ? { change: result.change } : null;
}

export async function continueNextLevelAction(goalId: string): Promise<boolean> {
  const response = await postAsLearner({
    path: `/v1/goals/${encodeURIComponent(goalId)}/next-level`,
  });

  return response.ok;
}
