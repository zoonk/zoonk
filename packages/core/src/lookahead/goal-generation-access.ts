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

/**
 * Whether the signed-in learner may (re)start what one of their goals needs written: its
 * curriculum, or its explanation for an explain question. The runs themselves are idempotent, so
 * starting again after a failure only redoes what is missing. Another learner's goal is not found.
 * Starting it again with a newer research run (`withResearch`) once the plan is built reconciles
 * the plan with what that research read, which asks models again, so it counts as small AI help:
 * repeating it can't run models without limit.
 */
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

  // The plan is built once its skill graph is written; before, the run builds it the first time.
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
