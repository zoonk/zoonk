import "server-only";
import { type PlanOperation } from "../plan-contract";
import { toIsoDate } from "../planner/plan-calendar";
import { assertTargetDates } from "../target-date-range";
import { type PlanContext } from "./plan-context";

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
