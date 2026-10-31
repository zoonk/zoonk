import { type PlanSetupTask } from "@zoonk/core/plans/setup";
import {
  fitPlanToRoutineStep,
  runPlanSetupTaskStep,
  searchRoutineMemoryStep,
  selectRoutineMemoryStep,
} from "./steps/goal-plan-steps";

async function fitPlanToRoutineInSteps(goalId: string): Promise<void> {
  const search = await searchRoutineMemoryStep(goalId);

  if (!search) {
    return;
  }

  const memory =
    "terms" in search
      ? await selectRoutineMemoryStep({ goalId, terms: search.terms })
      : search.memory;

  await fitPlanToRoutineStep({ goalId, memory });
}

function runSetupTask({ goalId, task }: { goalId: string; task: PlanSetupTask }): Promise<void> {
  return task === "routine"
    ? fitPlanToRoutineInSteps(goalId)
    : runPlanSetupTaskStep({ goalId, task });
}

/** A task that still fails stays owed for the goal's next run, so this run goes on without it. */
export function setUpPlan({
  goalId,
  tasks,
}: {
  goalId: string;
  tasks: readonly PlanSetupTask[];
}): Promise<unknown> {
  return tasks.reduce<Promise<unknown>>(
    (previous, task) => previous.then(() => runSetupTask({ goalId, task }).catch(() => null)),
    Promise.resolve(),
  );
}
