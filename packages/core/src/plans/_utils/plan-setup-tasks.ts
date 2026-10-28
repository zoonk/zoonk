import "server-only";
import { type PlanSetupTask, type TransactionClient, prisma } from "@zoonk/db";

type SetupTask = { goalId: string; task: PlanSetupTask };

/**
 * Thrown inside the effect's transaction, so a task another run ended first rolls this run's effect
 * back.
 */
export class PlanSetupTaskEndedError extends Error {
  constructor(task: PlanSetupTask) {
    super(`The plan's ${task} setup already ran.`);
    this.name = "PlanSetupTaskEndedError";
  }
}

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

export function endPlanSetupTaskWith(input: SetupTask): (tx: TransactionClient) => Promise<void> {
  return async (tx) => {
    if (!(await endPlanSetupTask({ ...input, db: tx }))) {
      throw new PlanSetupTaskEndedError(input.task);
    }
  };
}

export async function isPlanSetupTaskOwed({ goalId, task }: SetupTask): Promise<boolean> {
  const plan = await prisma.plan.findUnique({ select: { setupTasks: true }, where: { goalId } });
  return plan?.setupTasks.includes(task) ?? false;
}
