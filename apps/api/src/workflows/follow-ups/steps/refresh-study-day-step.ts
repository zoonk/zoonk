import { refreshOwedStudyDay } from "@zoonk/core/sessions/refresh-owed-day";
import { catchPlanConflict } from "../../_shared/plan-conflict-outcome";
import { type PlanStepOutcome } from "../../_shared/plan-conflict-retry";

export async function refreshStudyDayStep(
  input: Parameters<typeof refreshOwedStudyDay>[0],
): Promise<PlanStepOutcome<void>> {
  "use step";

  return catchPlanConflict(() => refreshOwedStudyDay(input));
}
