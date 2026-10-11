import "server-only";
import { type PlanSetupTask, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { applyPlacementToNewPlan } from "../learner/placement/_utils/apply-placement";
import { fitPlanToRoutine } from "./_utils/fit-plan-to-routine";
import { PlanSetupTaskEndedError, isPlanSetupTaskOwed } from "./_utils/plan-setup-tasks";
import { askAboutNoticeDay } from "./notice-plan-change";

export { type PlanSetupTask } from "@zoonk/db";

/**
 * The order a new plan's setup runs in: placement first, since fitting the routine starts from
 * what's left to study, and the notice's day last, so its proposal reads the plan the learner gets.
 */
const SETUP_ORDER: readonly PlanSetupTask[] = ["placement", "routine", "notice"];

const SETUP_TASKS: Record<PlanSetupTask, (goalId: string) => Promise<void>> = {
  notice: askAboutNoticeDay,
  placement: applyPlacementToNewPlan,
  routine: fitPlanToRoutine,
};

/** The tasks of `tasks` in the order they run. */
function toSetupOrder(tasks: readonly PlanSetupTask[]): PlanSetupTask[] {
  return SETUP_ORDER.filter((task) => tasks.includes(task));
}

/**
 * Runs one task a new plan still owes (see `Plan.setupTasks`): the placement the learner ended
 * before the plan existed, the fit to their routine, or the ask about the notice's day. Each runs
 * once: its effect ends the task in the same transaction, so a retry after it ran, or a run that
 * lost it to another, changes nothing; a task with nothing to do ends as well. A failure throws
 * and leaves the task owed, for the caller's retry or a later run.
 *
 * This is a workflow bridge: the goal comes from the run that built or prepares its plan.
 */
export async function runPlanSetupTask({
  goalId,
  task,
}: {
  goalId: string;
  task: PlanSetupTask;
}): Promise<void> {
  if (!(await isPlanSetupTaskOwed({ goalId, task }))) {
    return;
  }

  await SETUP_TASKS[task](goalId).catch((error: unknown) => {
    if (!(error instanceof PlanSetupTaskEndedError)) {
      throw error;
    }
  });
}

/** The tasks a goal's plan still owes, in the order they run. */
export async function listPlanSetupTasks(goalId: string): Promise<PlanSetupTask[]> {
  const plan = await prisma.plan.findUnique({ select: { setupTasks: true }, where: { goalId } });
  return toSetupOrder(plan?.setupTasks ?? []);
}

/**
 * Sets up a plan a request just built, in that request: each task the plan owes runs once, in
 * order, and one that fails is logged and stays owed, for the goal's next run to finish. Returns
 * the tasks still owed.
 */
export async function setUpPlanNow(goalId: string): Promise<PlanSetupTask[]> {
  for (const task of await listPlanSetupTasks(goalId)) {
    // oxlint-disable-next-line no-await-in-loop -- Each task reads the plan the one before left.
    const { error } = await safeAsync(() => runPlanSetupTask({ goalId, task }));

    if (error) {
      logError(`[plan setup] The ${task} setup of goal ${goalId}'s plan failed:`, error);
    }
  }

  return listPlanSetupTasks(goalId);
}
