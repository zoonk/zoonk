import "server-only";
import {
  type LearnerWriteTransaction,
  lockLearner,
  markLockedPlanInputsChanged,
  markPlanInputsChanged,
} from "@zoonk/db/learner-writes";

/**
 * Each learner write calls this once, first, in the transaction that owns its domain write: it
 * raises the plans' input version when the write changes what the planner reads (`planInputs`),
 * then locks the learner, so the learner's writes take turns.
 */
export async function markLearnerChanged(
  tx: LearnerWriteTransaction,
  {
    lockPlanIds = [],
    planInputs = false,
    userId,
  }: { lockPlanIds?: readonly string[]; planInputs?: boolean; userId: string },
): Promise<void> {
  if (planInputs) {
    /** Always acquire plan locks before the learner row, including in mixed writer transactions. */
    await markPlanInputsChanged(tx, { userIds: [userId] });
  }

  /** Planning-input writes already hold every owned plan; plan writes that keep inputs opt in. */
  await lockLearner(tx, { lockPlanIds: planInputs ? [] : lockPlanIds, userId });
}

/**
 * A shared-content writer marks dependent plans, then locks their learners in id order, so it
 * takes turns with each learner's own writes without deadlocking against another such writer.
 */
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
