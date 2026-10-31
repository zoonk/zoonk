import "server-only";
import { type GoalKind, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { claimAssist } from "../entitlements/claim-usage";
import { type RefusedUsage } from "../entitlements/contract";
import { findOwnedGoal } from "../learner/_utils/owned-goal";

export type GoalGenerationAccess =
  | { goal: { id: string; kind: GoalKind }; status: "ready" }
  | RefusedUsage
  | { status: "notFound" }
  | { status: "unauthorized" };

/** Requires ownership; retries reuse missing work, but withResearch after a built plan claims new AI help. */
export async function getGoalGenerationAccess({
  goalId,
  withResearch = false,
}: {
  goalId: string;
  withResearch?: boolean;
}): Promise<GoalGenerationAccess> {
  if (!isUuid(goalId)) {
    return { status: "notFound" };
  }

  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const goal = { id: owned.goal.id, kind: owned.goal.kind };

  if (!withResearch) {
    return { goal, status: "ready" };
  }

  const built = await prisma.plan.count({ where: { generatedAt: { not: null }, goalId } });

  if (built === 0) {
    return { goal, status: "ready" };
  }

  const usage = await claimAssist();

  if (usage.status === "unauthorized") {
    return usage;
  }

  return usage.status === "allowed" ? { goal, status: "ready" } : usage;
}
