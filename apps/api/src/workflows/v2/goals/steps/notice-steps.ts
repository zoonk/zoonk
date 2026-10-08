import { toGoalPlanGraph } from "@zoonk/core/library/curriculum/goal-plan-graph";
import { type GoalSkillGraph } from "@zoonk/core/library/curriculum/save-goal-skills";
import { listNoticeGoals, proposeNoticeChange } from "@zoonk/core/plans/notice-change";
import { claimNoticeLanding, endNoticeWait, startNoticeWait } from "@zoonk/core/plans/notice-wait";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

/**
 * The exam plan just built waits for research's reading of the notice; the reveal says so. The
 * wait only shapes the reveal, so a failure to record it is logged and never holds the plan.
 */
export async function startNoticeWaitStep(goalId: string): Promise<void> {
  "use step";

  const { error } = await safeAsync(() => startNoticeWait({ goalId }));

  if (error) {
    logError(`The plan of goal ${goalId} couldn't start waiting for its notice:`, error);
  }
}

/**
 * Whether the notice's reading still lands before the learner saw the plan (and the reveal keeps
 * waiting while the plan is built again); false once the wait ran out, or when it can't be told,
 * so the reading is proposed instead of changing a plan the learner may have seen.
 */
export async function claimNoticeLandingStep(goalId: string): Promise<boolean> {
  "use step";

  const { data, error } = await safeAsync(() => claimNoticeLanding({ goalId }));

  if (error) {
    logError(`The plan of goal ${goalId} couldn't claim its notice's landing:`, error);
  }

  return data ?? false;
}

/** The plan stops waiting for the notice; a failure is logged, and the wait runs out by itself. */
export async function endNoticeWaitStep(goalId: string): Promise<void> {
  "use step";

  const { error } = await safeAsync(() => endNoticeWait(goalId));

  if (error) {
    logError(`The plan of goal ${goalId} couldn't stop waiting for its notice:`, error);
  }
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
