import "server-only";
import { type GoalStatus, type TransactionClient, prisma } from "@zoonk/db";
import { getEntitlementViewer } from "../../entitlements/_utils/entitlement-viewer";
import { type AllowanceLimit } from "../../entitlements/contract";
import { getActiveGoalLimit } from "../../entitlements/limits";

/**
 * Resuming a goal counts against the plan's active goals like a new one: free learners follow one
 * goal at a time, so they pause another first.
 */
export async function findActiveGoalLimit({
  goalId,
  userId,
}: {
  goalId: string;
  userId: string;
}): Promise<AllowanceLimit | null> {
  const viewer = await getEntitlementViewer();
  const limit = viewer ? getActiveGoalLimit(viewer.tier) : null;

  if (!viewer || limit === null) {
    return null;
  }

  const active = await prisma.goal.count({
    where: { id: { not: goalId }, kind: { not: "explain" }, status: "active", userId },
  });

  return active >= limit
    ? { limit, period: "total", resource: "activeGoals", tier: viewer.tier }
    : null;
}

/**
 * When the goal the tabs show is archived or completed, the tabs move to the most recent goal still
 * active, or to none.
 */
export async function moveActiveGoalAway({
  goalId,
  status,
  tx,
  userId,
}: {
  goalId: string;
  status: GoalStatus;
  tx: TransactionClient;
  userId: string;
}): Promise<number> {
  if (status !== "archived" && status !== "completed") {
    return 0;
  }

  const next = await tx.goal.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { id: true },
    where: { id: { not: goalId }, kind: { not: "explain" }, status: "active", userId },
  });

  const moved = await tx.userLearningProfile.updateMany({
    data: { activeGoalId: next?.id ?? null },
    where: { activeGoalId: goalId, userId },
  });

  return moved.count;
}
