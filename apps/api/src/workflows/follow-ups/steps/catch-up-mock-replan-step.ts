import { catchUpMockReplan } from "@zoonk/core/plans/replan-after-mock";
import { catchPlanConflict } from "../../_shared/plan-conflict-outcome";
import { type PlanStepOutcome } from "../../_shared/plan-conflict-retry";

export async function catchUpMockReplanStep(
  input: Parameters<typeof catchUpMockReplan>[0],
): Promise<PlanStepOutcome<void>> {
  "use step";

  return catchPlanConflict(() => catchUpMockReplan(input));
}
