import "server-only";
import { prisma } from "@zoonk/db";
import { type AppliedChange, proposeChange } from "./_utils/apply-plan-change";
import { loadPlanContext } from "./_utils/plan-context";
import { type PlanChangeRecord } from "./_utils/replan";
import { withPlanRetry } from "./plan-conflict";
import { type PlanOperation } from "./plan-contract";

export type PlanProposalResult = AppliedChange | { status: "notFound" | "saved" | "unchanged" };

/**
 * Suggests a change to a learner's plan from another part of core, such as a memory insight ("I
 * added a 3-minute lesson on fractions") or the weekly rebalance. `reason` is the one sentence the
 * learner sees, in their language. A change of at most one lesson that moves the end date by at
 * most a day applies at once with an undo; anything bigger waits for the learner's OK as a
 * proposal on the plan. Callers pass a goal id they already resolved for the learner.
 */
export async function proposePlanChange({
  goalId,
  operations,
  provenance = null,
  reason,
  retryOnConflict = true,
  source,
}: {
  goalId: string;
  operations: readonly PlanOperation[];
  provenance?: PlanChangeRecord["provenance"];
  reason: string;
  /** Background work yields to a winning write rather than recomputing alternatives. */
  retryOnConflict?: boolean;
  /** Who suggests it, such as "memory" or "preparation". */
  source: string;
}): Promise<PlanProposalResult> {
  const propose = async (): Promise<PlanProposalResult> => {
    const goal = await prisma.goal.findUnique({ where: { id: goalId } });
    const context = goal ? await loadPlanContext({ goal }) : null;

    if (!context) {
      return { status: "notFound" };
    }

    return proposeChange({ context, operations, provenance, reason, source });
  };

  return retryOnConflict ? withPlanRetry(propose) : propose();
}
