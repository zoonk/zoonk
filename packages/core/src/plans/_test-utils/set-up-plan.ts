import { type PlanSetupTask } from "@zoonk/db";
import { createGoalPlan } from "../create-goal-plan";
import {
  fitPlanToRoutine,
  listPlanSetupTasks,
  runPlanSetupTask,
  searchRoutineMemory,
  selectRoutineMemory,
} from "../plan-setup";

export async function fitRoutineInSteps(goalId: string): Promise<void> {
  const search = await searchRoutineMemory(goalId);

  if (!search) {
    return;
  }

  const memory =
    "terms" in search ? await selectRoutineMemory({ goalId, terms: search.terms }) : search.memory;

  await fitPlanToRoutine({ goalId, memory });
}

function runSetupTask({ goalId, task }: { goalId: string; task: PlanSetupTask }): Promise<void> {
  return task === "routine" ? fitRoutineInSteps(goalId) : runPlanSetupTask({ goalId, task });
}

export async function setUpPlanInSteps(goalId: string): Promise<void> {
  for (const task of await listPlanSetupTasks(goalId)) {
    // oxlint-disable-next-line no-await-in-loop -- Each task reads the plan the one before left.
    await runSetupTask({ goalId, task });
  }
}

export async function createSetUpGoalPlan(
  input: Parameters<typeof createGoalPlan>[0],
): Promise<void> {
  await createGoalPlan(input);
  await setUpPlanInSteps(input.goalId);
}
