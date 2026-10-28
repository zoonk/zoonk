import "server-only";
import { isPlanReady } from "./_utils/apply-plan-change";
import { commitPlan } from "./_utils/commit-plan";
import { getCoverageChange } from "./_utils/coverage-change";
import { followPlanToday } from "./_utils/follow-plan-today";
import { getListeningPastBasicsEffect, withPastBasicsAreas } from "./_utils/level-listening-starts";
import { loadPlanAtToken } from "./_utils/plan-token";
import { computePlan } from "./_utils/replan";
import { withPlanRetry } from "./plan-conflict";

export async function replanAfterPlacement({
  goalId,
  now,
  pastBasicsAreas = [],
  timeZone,
}: {
  goalId: string;
  now: Date;
  pastBasicsAreas?: readonly string[];
  timeZone: string;
}): Promise<void> {
  await withPlanRetry(async () => {
    const context = await loadPlanAtToken(goalId, { now, timeZone });

    if (!context || !isPlanReady(context)) {
      return;
    }

    const computed = await computePlan({
      context,
      mode: "forced",
      now,
      state: withPastBasicsAreas({ areas: pastBasicsAreas, state: context.state }),
    });

    if (computed.inputsKey === context.plan.inputsKey) {
      return;
    }

    const changeId = await commitPlan({
      change: getCoverageChange({
        computed,
        ...getListeningPastBasicsEffect({ areas: pastBasicsAreas, state: context.state }),
      }),
      computed,
      context,
    });

    await followPlanToday({ changeId, context });
  });
}
