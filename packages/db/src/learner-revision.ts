import { type TransactionClient } from "./index";

/** Marking only runs SQL, so any transaction or client that can do that may mark. */
export type LearnerRevisionTransaction = Pick<TransactionClient, "$executeRaw" | "$queryRaw">;

/** Raises these plans' input version. The caller already holds their locks. */
export async function markLockedPlanInputsChanged(
  tx: LearnerRevisionTransaction,
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
  tx: LearnerRevisionTransaction,
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
  tx: LearnerRevisionTransaction,
  { userIds }: { userIds: readonly string[] },
): Promise<string[]> {
  const planIds = await lockLearnerPlans(tx, { userIds });
  await markLockedPlanInputsChanged(tx, { planIds });
  return planIds;
}

/**
 * Raises the revision clients compare to know a learner's summary changed. Revision-only writers
 * that update plans lock those owned plans here first, without invalidating their planning inputs.
 */
export async function markLearnerRevision(
  tx: LearnerRevisionTransaction,
  { lockPlanIds = [], userId }: { lockPlanIds?: readonly string[]; userId: string },
): Promise<{ learnerRevision: bigint }> {
  if (lockPlanIds.length > 0) {
    await tx.$queryRaw`
      SELECT plan.id FROM plans AS plan
      JOIN goals AS goal ON goal.id = plan.goal_id
      WHERE plan.id = ANY(${[...lockPlanIds]}::uuid[]) AND goal.user_id = ${userId}::uuid
      ORDER BY plan.id FOR UPDATE OF plan
    `;
  }

  const [user] = await tx.$queryRaw<{ learnerRevision: bigint }[]>`
    UPDATE users SET learner_revision = learner_revision + 1
    WHERE id = ${userId}::uuid
    RETURNING learner_revision AS "learnerRevision"
  `;

  if (!user) {
    throw new Error("Cannot mark a missing learner changed");
  }

  return user;
}
