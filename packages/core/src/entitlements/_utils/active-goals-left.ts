import { type TransactionClient, prisma } from "@zoonk/db";
import { type EntitlementTier } from "../contract";
import { getActiveGoalLimit } from "../limits";

export function countActiveGoals({
  db = prisma,
  exceptGoalId,
  userId,
}: {
  db?: TransactionClient;
  exceptGoalId?: string;
  userId: string;
}): Promise<number> {
  return db.goal.count({
    where: {
      id: exceptGoalId ? { not: exceptGoalId } : undefined,
      kind: { not: "explain" },
      status: "active",
      userId,
    },
  });
}

/** Null when the plan has no cap. */
export function getActiveGoalsLeft({
  active,
  tier,
}: {
  active: number;
  tier: EntitlementTier;
}): number | null {
  const limit = getActiveGoalLimit(tier);
  return limit === null ? null : Math.max(0, limit - active);
}

/** Uncached, so a write's recount under its lock is current. */
export async function countActiveGoalsLeft({
  db = prisma,
  exceptGoalId,
  tier,
  userId,
}: {
  db?: TransactionClient;
  exceptGoalId?: string;
  tier: EntitlementTier;
  userId: string;
}): Promise<number | null> {
  if (getActiveGoalLimit(tier) === null) {
    return null;
  }

  const active = await countActiveGoals({ db, exceptGoalId, userId });
  return getActiveGoalsLeft({ active, tier });
}
