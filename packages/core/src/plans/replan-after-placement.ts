import "server-only";
import { keepOpenSessionSelection } from "../sessions/_utils/skip-tested-out-blocks";
import { isPlanReady } from "./_utils/apply-plan-change";
import { commitPlan } from "./_utils/commit-plan";
import { getCoverageChange } from "./_utils/coverage-change";
import { loadPlanAtToken } from "./_utils/plan-token";
import { computePlan } from "./_utils/replan";
import { afterPlanInputWrite } from "./plan-conflict";

export async function replanAfterPlacement({
  goalId,
  now,
  timeZone,
}: {
  goalId: string;
  now: Date;
  timeZone: string;
}): Promise<void> {
  await afterPlanInputWrite(async () => {
    const context = await loadPlanAtToken(goalId, { now, timeZone });

    if (!context || !isPlanReady(context)) {
      return;
    }

    const computed = await computePlan({ context, mode: "forced", now });

    if (computed.inputsKey === context.plan.inputsKey) {
      return;
    }

    await commitPlan({
      change: getCoverageChange(computed),
      computed,
      context,
      extraWrites: (tx) =>
        keepOpenSessionSelection(tx, { goalId, planVersion: context.plan.version + 1 }),
    });
  });
}
