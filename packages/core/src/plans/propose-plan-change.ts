import "server-only";
import { type AppliedChange, proposeChange } from "./_utils/apply-plan-change";
import { type PlanChangePayload } from "./_utils/plan-change-payload";
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
  approval,
  goalId,
  operations,
  payload,
  provenance = null,
  reason,
  retryOnConflict = true,
  source,
}: {
  /** "always" asks the learner even for a change small enough to apply at once. */
  approval?: "always" | "whenLarge";
  goalId: string;
  payload?: Pick<PlanChangePayload, "releaseId">;
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

    return proposeChange({ approval, context, operations, payload, provenance, reason, source });
  };

  return retryOnConflict ? withPlanRetry(propose) : propose();
}
