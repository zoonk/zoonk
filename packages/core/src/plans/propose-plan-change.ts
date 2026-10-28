import "server-only";
import { type AppliedChange, proposeChange } from "./_utils/apply-plan-change";
import { loadPlanAtToken } from "./_utils/plan-token";
import { type PlanChangeRecord } from "./_utils/replan";
import { withPlanRetry } from "./plan-conflict";
import { type PlanOperation } from "./plan-contract";

export type PlanProposalResult = AppliedChange | { status: "notFound" | "saved" | "unchanged" };

/**
 * Callers pass a goal id they already resolved for the learner; `reason` is the sentence the
 * learner sees, in their language.
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
  retryOnConflict?: boolean;
  source: string;
}): Promise<PlanProposalResult> {
  const propose = async (): Promise<PlanProposalResult> => {
    const context = await loadPlanAtToken(goalId);

    if (!context) {
      return { status: "notFound" };
    }

    return proposeChange({ context, operations, provenance, reason, source });
  };

  return retryOnConflict ? withPlanRetry(propose) : propose();
}
