import "server-only";
import {
  type LearnerRevisionTransaction,
  type PlanInputChange,
  markLearnerRevision,
  markLockedPlanInputsChanged,
  markPlanInputsChanged,
} from "@zoonk/db/learner-revision";

/** Each learner-visible writer calls this once, in the transaction that owns its domain write. */
export async function markLearnerChanged(
  tx: LearnerRevisionTransaction,
  {
    adaptation = [],
    adaptationGoalId,
    allPlansAdaptation = [],
    lockPlanIds = [],
    pendingPace,
    planInputs = false,
    userId,
  }: PlanInputChange & { lockPlanIds?: readonly string[]; planInputs?: boolean; userId: string },
): Promise<{ learnerRevision: bigint }> {
  const changesPlanInputs =
    planInputs ||
    adaptation.length > 0 ||
    allPlansAdaptation.length > 0 ||
    pendingPace !== undefined;

  if (changesPlanInputs) {
    /** Always acquire plan locks before the learner row, including in mixed writer transactions. */
    await markPlanInputsChanged(tx, {
      adaptation,
      adaptationGoalId,
      allPlansAdaptation,
      pendingPace,
      userIds: [userId],
    });
  }

  /** Planning-input writes already hold every owned plan; revision-only plan writes opt in. */
  return markLearnerRevision(tx, { lockPlanIds: changesPlanInputs ? [] : lockPlanIds, userId });
}

/** A shared-content writer marks dependent plans, without returning another learner's revision. */
export async function markPlansChanged(
  tx: LearnerRevisionTransaction,
  { adaptation, planIds }: Pick<PlanInputChange, "adaptation"> & { planIds: readonly string[] },
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

  await markLockedPlanInputsChanged(tx, { adaptation, planIds: plans.map((plan) => plan.id) });

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
