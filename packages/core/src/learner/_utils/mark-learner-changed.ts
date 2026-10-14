import "server-only";
import { type TransactionClient } from "@zoonk/db";

/** Each learner-visible writer calls this once, in the transaction that owns its domain write. */
export async function markLearnerChanged(
  tx: TransactionClient,
  { userId, planInputs = false }: { userId: string; planInputs?: boolean },
): Promise<{ learnerRevision: bigint }> {
  if (planInputs) {
    /** Always acquire plan locks before the learner row, including in mixed writer transactions. */
    const plans = await tx.$queryRaw<{ id: string }[]>`
      SELECT plan.id FROM plans AS plan
      JOIN goals AS goal ON goal.id = plan.goal_id
      WHERE goal.user_id = ${userId}::uuid
      ORDER BY plan.id FOR UPDATE OF plan
    `;

    await tx.$executeRaw`
      UPDATE plans SET input_version = input_version + 1
      WHERE id = ANY(${plans.map((plan) => plan.id)}::uuid[])
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

/** A shared-content writer marks dependent plans, without returning another learner's revision. */
export async function markPlansChanged(
  tx: TransactionClient,
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

  for (const userId of userIds) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Acquire each owner lock in the same stable order.
    await markLearnerChanged(tx, { userId });
  }
}
