import "server-only";
import { type PlanSetupTask, type TransactionClient, prisma } from "@zoonk/db";

type SetupTask = { goalId: string; task: PlanSetupTask };

/** A task another run ended first: thrown in the transaction of this run's effect, which rolls back. */
export class PlanSetupTaskEndedError extends Error {
  constructor(task: PlanSetupTask) {
    super(`The plan's ${task} setup already ran.`);
    this.name = "PlanSetupTaskEndedError";
  }
}

/** Ends a new plan's setup task in `db`; false when the plan didn't owe it any more. */
export async function endPlanSetupTask({
  db = prisma,
  goalId,
  task,
}: SetupTask & { db?: TransactionClient }): Promise<boolean> {
  const ended = await db.$executeRaw`
    UPDATE plans SET setup_tasks = array_remove(setup_tasks, ${task}::"PlanSetupTask")
    WHERE goal_id = ${goalId}::uuid AND ${task}::"PlanSetupTask" = ANY(setup_tasks)`;

  return ended > 0;
}

/**
 * The write that ends a task with its effect, in the effect's transaction (`extraWrites`): a task
 * another run ended first rolls this run's effect back, so it lands once.
 */
export function endPlanSetupTaskWith(input: SetupTask): (tx: TransactionClient) => Promise<void> {
  return async (tx) => {
    if (!(await endPlanSetupTask({ ...input, db: tx }))) {
      throw new PlanSetupTaskEndedError(input.task);
    }
  };
}

/** Whether the goal's plan still owes the task. */
export async function isPlanSetupTaskOwed({ goalId, task }: SetupTask): Promise<boolean> {
  const plan = await prisma.plan.findUnique({ select: { setupTasks: true }, where: { goalId } });
  return plan?.setupTasks.includes(task) ?? false;
}
