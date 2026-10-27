import { type TransactionClient } from "./index";

/** Marking and locking only run SQL, so any transaction or client that can do that may. */
export type LearnerWriteTransaction = Pick<TransactionClient, "$executeRaw" | "$queryRaw">;

/** Raises these plans' input version. The caller already holds their locks. */
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
 * Locks every plan these learners' goals have, in id order, and returns them. Learner writers lock
 * plans, then learner rows, then their own rows, so two of them wait for each other instead of
 * deadlocking. A writer that reads what it then marks takes them first; marking retakes them.
 */
async function lockLearnerPlans(
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

/**
 * Raises the input version of every plan these learners' goals have, locking the plans in id
 * order first (`lockLearnerPlans`), and returns the plans it marked. Core's writers and auth's
 * guest link share it.
 */
export async function markPlanInputsChanged(
  tx: LearnerWriteTransaction,
  { userIds }: { userIds: readonly string[] },
): Promise<string[]> {
  const planIds = await lockLearnerPlans(tx, { userIds });
  await markLockedPlanInputsChanged(tx, { planIds });
  return planIds;
}

/**
 * Locks the learner's row until the transaction ends, so their writes take turns: a writer reads
 * what it then changes under it. Writers that update plans without changing their inputs lock those
 * owned plans here first: every writer locks plans, then learners, then its own rows, so two of them
 * wait for each other instead of deadlocking.
 */
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
