import "server-only";
import { type PlanOperation } from "../plan-contract";
import { toIsoDate } from "../planner/plan-calendar";
import { assertTargetDates } from "../target-date-range";
import { type PlanContext } from "./plan-context";

/**
 * Refuses a learner's new plan date past what a plan reaches (see `assertTargetDates`) before the
 * change is planned, undone or saved; their goal's own date, even a passed one, is never judged
 * again. A past date stays the planner's to refuse (`pastDate`), with the answer it always had.
 */
export function assertPlanTargetDates({
  context,
  operations,
}: {
  context: PlanContext;
  operations: readonly PlanOperation[];
}): void {
  const current = context.state.goal.targetDate;

  assertTargetDates({
    latestOnly: true,
    targets: operations.flatMap((operation, index) =>
      operation.kind === "setTargetDate"
        ? [{ current, path: ["operations", index, "targetDate"], targetDate: operation.targetDate }]
        : [],
    ),
    today: toIsoDate(context.today),
  });
}
