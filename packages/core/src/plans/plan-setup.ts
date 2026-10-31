import "server-only";
import { type PlanSetupTask, prisma } from "@zoonk/db";
import { applyPlacementToNewPlan } from "../learner/placement/_utils/apply-placement";
import { fitPlanToRoutineMemory } from "./_utils/fit-plan-to-routine";
import { PlanSetupTaskEndedError, isPlanSetupTaskOwed } from "./_utils/plan-setup-tasks";
import { askAboutNoticeDay } from "./notice-plan-change";

export { type PlanSetupTask } from "@zoonk/db";
export { type PlanMemorySearch } from "./_utils/plan-memory";
export { searchRoutineMemory, selectRoutineMemory } from "./_utils/fit-plan-to-routine";

/**
 * Placement first, since the routine's fit starts from what's left; the notice's day last, so it
 * reads the plan the learner gets.
 */
const SETUP_ORDER: readonly PlanSetupTask[] = ["placement", "routine", "notice"];

const SETUP_TASKS: Record<Exclude<PlanSetupTask, "routine">, (goalId: string) => Promise<void>> = {
  notice: askAboutNoticeDay,
  placement: applyPlacementToNewPlan,
};

function toSetupOrder(tasks: readonly PlanSetupTask[]): PlanSetupTask[] {
  return SETUP_ORDER.filter((task) => tasks.includes(task));
}

async function runOwedTask({
  goalId,
  run,
  task,
}: {
  goalId: string;
  run: () => Promise<void>;
  task: PlanSetupTask;
}): Promise<void> {
  if (!(await isPlanSetupTaskOwed({ goalId, task }))) {
    return;
  }

  await run().catch((error: unknown) => {
    if (!(error instanceof PlanSetupTaskEndedError)) {
      throw error;
    }
  });
}

/**
 * Each task runs once; a failure throws and leaves it owed. Workflow bridge: the goal comes from
 * the run that built its plan. The routine runs in three calls, one model call each:
 * `searchRoutineMemory`, `selectRoutineMemory` when it returns terms, then `fitPlanToRoutine`.
 */
export function runPlanSetupTask({
  goalId,
  task,
}: {
  goalId: string;
  task: Exclude<PlanSetupTask, "routine">;
}): Promise<void> {
  return runOwedTask({ goalId, run: () => SETUP_TASKS[task](goalId), task });
}

export function fitPlanToRoutine(input: { goalId: string; memory: string[] }): Promise<void> {
  return runOwedTask({
    goalId: input.goalId,
    run: () => fitPlanToRoutineMemory(input),
    task: "routine",
  });
}

export async function listPlanSetupTasks(goalId: string): Promise<PlanSetupTask[]> {
  const plan = await prisma.plan.findUnique({ select: { setupTasks: true }, where: { goalId } });
  return toSetupOrder(plan?.setupTasks ?? []);
}
