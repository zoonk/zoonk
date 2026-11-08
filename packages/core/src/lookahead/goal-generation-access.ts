import "server-only";
import { type GoalKind, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { claimAssist } from "../entitlements/claim-usage";
import { type RefusedUsage } from "../entitlements/contract";
import { type GoalRebuildFollowUp, requestGoalRebuild } from "../goals/goal-rebuild-follow-up";
import { findOwnedGoal } from "../learner/_utils/owned-goal";

export type GoalGenerationAccess =
  | { goal: { followUp?: GoalRebuildFollowUp; id: string; kind: GoalKind }; status: "ready" }
  | RefusedUsage
  | { status: "notFound" }
  | { status: "unauthorized" };

/** Requires ownership; a saved graph owes a rebuild, and newer research claims small AI help. */
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

  const ready = async (): Promise<GoalGenerationAccess> => {
    const followUp = await requestGoalRebuild(owned.goal);

    return {
      goal: { ...(followUp ? { followUp } : {}), id: owned.goal.id, kind: owned.goal.kind },
      status: "ready",
    };
  };

  if (!withResearch) {
    return ready();
  }

  const built = await prisma.plan.count({ where: { generatedAt: { not: null }, goalId } });

  if (built === 0) {
    return ready();
  }

  const usage = await claimAssist();

  if (usage.status === "unauthorized") {
    return usage;
  }

  return usage.status === "allowed" ? ready() : usage;
}
