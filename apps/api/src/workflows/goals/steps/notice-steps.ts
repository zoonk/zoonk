import { prepareNoticeGraphRepair } from "@zoonk/core/library/curriculum/exam-graph-repair";
import { toGoalPlanGraph } from "@zoonk/core/library/curriculum/goal-plan-graph";
import { type GoalSkillGraph } from "@zoonk/core/library/curriculum/save-goal-skills";
import {
  listNoticeGoals,
  listNoticeRepairBlueprints,
  proposeNoticeChange,
  repairNoticePlan,
} from "@zoonk/core/plans/notice-change";
import { applyNoticeGraph } from "@zoonk/core/plans/notice-graph";
import { claimNoticeLanding, endNoticeWait } from "@zoonk/core/plans/notice-wait";
import { logError } from "@zoonk/utils/logger";
import { catchPlanConflict } from "../../_shared/plan-conflict-outcome";
import { type PlanStepOutcome } from "../../_shared/plan-conflict-retry";

export async function claimNoticeLandingStep(goalId: string): Promise<boolean> {
  "use step";

  return claimNoticeLanding({ goalId });
}

export async function logReconcileFailureStep(failure: {
  error: string;
  goalId: string;
  researchId: string;
}): Promise<void> {
  "use step";

  logError(
    "[goalContentWorkflow] Research's reading couldn't be reconciled with the plan:",
    failure,
  );
}

export async function endNoticeWaitStep(goalId: string): Promise<void> {
  "use step";

  await endNoticeWait(goalId);
}

export async function applyNoticeGraphStep({
  blueprintId,
  courseIdsByKey,
  droppedSkillIds,
  goalId,
  graph,
  idsByKey,
}: {
  blueprintId: string;
  courseIdsByKey: Record<string, string>;
  droppedSkillIds: string[];
  goalId: string;
  graph: GoalSkillGraph;
  idsByKey: Record<string, string>;
}): Promise<PlanStepOutcome<boolean>> {
  "use step";

  return catchPlanConflict(() =>
    applyNoticeGraph({
      blueprintId,
      droppedSkillIds,
      goalId,
      graph: toGoalPlanGraph({ courseIdsByKey, graph, idsByKey }),
    }),
  );
}

export async function proposeNoticeChangeStep({ goalId }: { goalId: string }): Promise<void> {
  "use step";

  await proposeNoticeChange({ goalId });
}

export async function listNoticeGoalsStep(input: {
  after: string | null;
  examBlueprintId: string;
  exceptGoalId: string | null;
}): Promise<{ goalIds: string[]; next: string | null }> {
  "use step";

  return listNoticeGoals(input);
}

export async function repairNoticePlanStep(
  input: Parameters<typeof repairNoticePlan>[0],
): Promise<void> {
  "use step";

  await repairNoticePlan(input);
}

export async function logNoticeRepairFailureStep(failure: {
  blueprintId?: string;
  error: string;
  goalId?: string;
}): Promise<void> {
  "use step";

  logError("[notice] Could not repair an exam graph:", failure);
}

export async function listNoticeRepairBlueprintsStep(after: string | null): Promise<string[]> {
  "use step";

  return listNoticeRepairBlueprints(after);
}

export async function prepareNoticeGraphRepairStep(blueprintId: string) {
  "use step";

  return prepareNoticeGraphRepair(blueprintId);
}
