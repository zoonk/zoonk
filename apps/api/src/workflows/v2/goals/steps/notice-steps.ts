import { toGoalPlanGraph } from "@zoonk/core/library/curriculum/goal-plan-graph";
import { type GoalSkillGraph } from "@zoonk/core/library/curriculum/save-goal-skills";
import { listNoticeGoals, proposeNoticeChange } from "@zoonk/core/plans/notice-change";
import { claimNoticeLanding, endNoticeWait, startNoticeWait } from "@zoonk/core/plans/notice-wait";
import { logError } from "@zoonk/utils/logger";

/**
 * The exam plan just built waits for research's reading of the notice; the reveal says so. A
 * failed write throws, so the runtime retries it; the wait only shapes the reveal, so once the
 * retries run out the plan goes on without it.
 */
export async function startNoticeWaitStep(goalId: string): Promise<void> {
  "use step";

  await startNoticeWait({ goalId });
}

/**
 * Whether the notice's reading still lands before the learner saw the plan (and the reveal keeps
 * waiting while the plan is built again); false once the wait ran out. A failed write throws, so
 * the runtime retries it; once the retries run out, the run takes it as false, so the reading is
 * proposed instead of changing a plan the learner may have seen.
 */
export async function claimNoticeLandingStep(goalId: string): Promise<boolean> {
  "use step";

  return claimNoticeLanding({ goalId });
}

/**
 * Research's reading couldn't be reconciled with the plan once its steps' retries ran out: the
 * plan stays usable as it was and stops waiting, so the failure is only said, loudly, with the ids
 * to find it by.
 */
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

/**
 * The plan stops waiting for the notice. A failed write throws, so the runtime retries it; once
 * the retries run out, the wait runs out by itself.
 */
export async function endNoticeWaitStep(goalId: string): Promise<void> {
  "use step";

  await endNoticeWait(goalId);
}

/**
 * Proposes what the notice changes after the learner saw the plan: the graph the reconciliation
 * wrote (its added skills already in the Library), and the notice's exam day when it isn't the
 * goal's date. Without a graph, only the date.
 */
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

/** A page of the exam goals a blueprint's new or corrected notice concerns, after `after`. */
export async function listNoticeGoalsStep(input: {
  after: string | null;
  examBlueprintId: string;
  exceptGoalId: string | null;
}): Promise<{ goalIds: string[]; next: string | null }> {
  "use step";

  return listNoticeGoals(input);
}

/**
 * Proposes the notice's exam day to each goal whose date isn't it, with the notice's message as
 * the change's sentence.
 */
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
