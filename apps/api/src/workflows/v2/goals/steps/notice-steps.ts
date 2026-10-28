import { toGoalPlanGraph } from "@zoonk/core/library/curriculum/goal-plan-graph";
import { type GoalSkillGraph } from "@zoonk/core/library/curriculum/save-goal-skills";
import { listNoticeGoals, proposeNoticeChange } from "@zoonk/core/plans/notice-change";
import { claimNoticeLanding, endNoticeWait, startNoticeWait } from "@zoonk/core/plans/notice-wait";
import { logError } from "@zoonk/utils/logger";

export async function startNoticeWaitStep(goalId: string): Promise<void> {
  "use step";

  await startNoticeWait({ goalId });
}

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

export async function proposeNoticeChangeStep({
  courseIdsByKey,
  goalId,
  graph = null,
  idsByKey,
}: {
  courseIdsByKey?: Record<string, string>;
  goalId: string;
  graph?: GoalSkillGraph | null;
  idsByKey?: Record<string, string>;
}): Promise<void> {
  "use step";

  await proposeNoticeChange({
    goalId,
    graph:
      graph && idsByKey && courseIdsByKey
        ? toGoalPlanGraph({ courseIdsByKey, graph, idsByKey })
        : null,
  });
}

export async function listNoticeGoalsStep(input: {
  after: string | null;
  examBlueprintId: string;
  exceptGoalId: string | null;
}): Promise<{ goalIds: string[]; next: string | null }> {
  "use step";

  return listNoticeGoals(input);
}

export async function proposeNoticeDatesStep({
  goalIds,
  noticeId,
}: {
  goalIds: string[];
  noticeId: string | null;
}): Promise<void> {
  "use step";

  for (const goalId of goalIds) {
    // oxlint-disable-next-line no-await-in-loop -- Each re-plans a goal; one at a time spares the database.
    await proposeNoticeChange({ goalId, noticeId });
  }
}
