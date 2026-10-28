import "server-only";
import {
  type LearnerWriteTransaction,
  lockLearner,
  markLockedPlanInputsChanged,
  markPlanInputsChanged,
} from "@zoonk/db/learner-writes";

/** Call once before domain writes in the owning transaction; acquires plan locks before the learner lock. */
export async function markLearnerChanged(
  tx: LearnerWriteTransaction,
  {
    lockPlanIds = [],
    planInputs = false,
    userId,
  }: { lockPlanIds?: readonly string[]; planInputs?: boolean; userId: string },
): Promise<void> {
  if (planInputs) {
    await markPlanInputsChanged(tx, { userIds: [userId] });
  }

  await lockLearner(tx, { lockPlanIds: planInputs ? [] : lockPlanIds, userId });
}

/** Locks learners in id order after their plans to avoid deadlocks between shared-content writers. */
export async function markPlansChanged(
  tx: LearnerWriteTransaction,
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

  await markLockedPlanInputsChanged(tx, { planIds: plans.map((plan) => plan.id) });

  const userIds = [...new Set(plans.map((plan) => plan.userId))].toSorted();

  await tx.$queryRaw`
    SELECT id FROM users
    WHERE id = ANY(${userIds}::uuid[])
    ORDER BY id FOR UPDATE
  `;
}
