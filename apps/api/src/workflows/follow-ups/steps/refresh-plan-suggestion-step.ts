import { refreshPlanSuggestion } from "@zoonk/core/plans/refresh-suggestion";
import { catchPlanConflict } from "../../_shared/plan-conflict-outcome";
import { type PlanStepOutcome } from "../../_shared/plan-conflict-retry";

export async function refreshPlanSuggestionStep(
  input: Parameters<typeof refreshPlanSuggestion>[0],
): Promise<PlanStepOutcome<void>> {
  "use step";

  return catchPlanConflict(() => refreshPlanSuggestion(input));
}
