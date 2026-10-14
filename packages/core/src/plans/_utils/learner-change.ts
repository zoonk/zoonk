import "server-only";
import { type LearnerPlanOperation } from "../plan-contract";
import { type ComputedChange, computeChange } from "./compute-change";
import { applyChangeOperations } from "./part-areas";
import { type PlanContext } from "./plan-context";

/**
 * What a learner's change would do, planned as applying it plans it, for the Plan to offer it with
 * its diff; null when it can't apply.
 */
export async function planLearnerChange({
  context,
  operations,
  reuseReadBuild = false,
}: {
  context: PlanContext;
  operations: LearnerPlanOperation[];
  reuseReadBuild?: boolean;
}): Promise<ComputedChange | null> {
  const result = await applyChangeOperations({ context, operations });

  if ("error" in result) {
    return null;
  }

  return computeChange({
    context,
    operations: result.operations,
    reuseReadBuild,
    state: result.state,
  });
}
