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
 * Placement first, since the routine's fit starts from what's left; the notice's day last, so it
 * reads the plan the learner gets.
 */
const SETUP_ORDER: readonly PlanSetupTask[] = ["placement", "routine", "notice"];

const SETUP_TASKS: Record<PlanSetupTask, (goalId: string) => Promise<void>> = {
  notice: askAboutNoticeDay,
  placement: applyPlacementToNewPlan,
  routine: fitPlanToRoutine,
};

function toSetupOrder(tasks: readonly PlanSetupTask[]): PlanSetupTask[] {
  return SETUP_ORDER.filter((task) => tasks.includes(task));
}

/**
 * Each task runs once; a failure throws and leaves it owed. Workflow bridge: the goal comes from
 * the run that built its plan.
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

export async function listPlanSetupTasks(goalId: string): Promise<PlanSetupTask[]> {
  const plan = await prisma.plan.findUnique({ select: { setupTasks: true }, where: { goalId } });
  return toSetupOrder(plan?.setupTasks ?? []);
}

/** A task that fails is logged and stays owed for the goal's next run. */
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
