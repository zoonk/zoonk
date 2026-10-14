import "server-only";
import {
  type LearnerRevisionTransaction,
  markLearnerRevision,
  markPlanInputsChanged,
} from "@zoonk/db/learner-revision";

/** Each learner-visible writer calls this once, in the transaction that owns its domain write. */
export async function markLearnerChanged(
  tx: LearnerRevisionTransaction,
  { userId, planInputs = false }: { userId: string; planInputs?: boolean },
): Promise<{ learnerRevision: bigint }> {
  if (planInputs) {
    /** Always acquire plan locks before the learner row, including in mixed writer transactions. */
    await markPlanInputsChanged(tx, { userIds: [userId] });
  }

  return markLearnerRevision(tx, { userId });
}

/** A shared-content writer marks dependent plans, without returning another learner's revision. */
export async function markPlansChanged(
  tx: LearnerRevisionTransaction,
  { planIds }: { planIds: readonly string[] },
): Promise<void> {
  if (planIds.length === 0) {
    return;
  }

  const plans = await tx.$queryRaw<{ id: string; userId: string }[]>`
    SELECT plan.id, goal.user_id AS "userId" FROM plans AS plan
    JOIN goals AS goal ON goal.id = plan.goal_id
    WHERE plan.id = ANY(${[...planIds]}::uuid[])
    ORDER BY plan.id FOR UPDATE OF plan
  `;

  await tx.$executeRaw`
    UPDATE plans SET input_version = input_version + 1
    WHERE id = ANY(${plans.map((plan) => plan.id)}::uuid[])
  `;

  /** Stable lock order prevents overlapping multi-owner writes from deadlocking each other. */
  const userIds = [...new Set(plans.map((plan) => plan.userId))].toSorted();

  await tx.$queryRaw`
    SELECT id FROM users
    WHERE id = ANY(${userIds}::uuid[])
    ORDER BY id FOR UPDATE
  `;

  await tx.$executeRaw`
    UPDATE users SET learner_revision = learner_revision + 1
    WHERE id = ANY(${userIds}::uuid[])
  `;
}
