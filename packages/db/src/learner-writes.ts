import { type TransactionClient } from "./index";

export type LearnerWriteTransaction = Pick<TransactionClient, "$executeRaw" | "$queryRaw">;

export async function markLockedPlanInputsChanged(
  tx: LearnerWriteTransaction,
  { planIds }: { planIds: readonly string[] },
): Promise<void> {
  await tx.$executeRaw`
    UPDATE plans SET input_version = input_version + 1
    WHERE id = ANY(${[...planIds]}::uuid[])
  `;
}

/**
 * Learner writers lock plans, then learner rows, then their own rows, so two of them wait for each
 * other instead of deadlocking.
 */
export async function lockLearnerPlans(
  tx: LearnerWriteTransaction,
  { userIds }: { userIds: readonly string[] },
): Promise<string[]> {
  const plans = await tx.$queryRaw<{ id: string }[]>`
    SELECT plan.id FROM plans AS plan
    JOIN goals AS goal ON goal.id = plan.goal_id
    WHERE goal.user_id = ANY(${[...userIds]}::uuid[])
    ORDER BY plan.id FOR UPDATE OF plan
  `;

  return plans.map((plan) => plan.id);
}

export async function markPlanInputsChanged(
  tx: LearnerWriteTransaction,
  { userIds }: { userIds: readonly string[] },
): Promise<string[]> {
  const planIds = await lockLearnerPlans(tx, { userIds });
  await markLockedPlanInputsChanged(tx, { planIds });
  return planIds;
}

/** Plans lock before learners (see `lockLearnerPlans`), so a writer passes the plans it updates. */
export async function lockLearner(
  tx: LearnerWriteTransaction,
  { lockPlanIds = [], userId }: { lockPlanIds?: readonly string[]; userId: string },
): Promise<void> {
  if (lockPlanIds.length > 0) {
    await tx.$queryRaw`
      SELECT plan.id FROM plans AS plan
      JOIN goals AS goal ON goal.id = plan.goal_id
      WHERE plan.id = ANY(${[...lockPlanIds]}::uuid[]) AND goal.user_id = ${userId}::uuid
      ORDER BY plan.id FOR UPDATE OF plan
    `;
  }

  const [user] = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM users WHERE id = ${userId}::uuid FOR NO KEY UPDATE
  `;

  if (!user) {
    throw new Error("Cannot lock a missing learner");
  }
}
