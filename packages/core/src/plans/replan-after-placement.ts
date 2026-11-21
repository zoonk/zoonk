import "server-only";
import { keepOpenSessionSelection } from "../sessions/_utils/skip-tested-out-blocks";
import { isPlanReady } from "./_utils/apply-plan-change";
import { commitPlan } from "./_utils/commit-plan";
import { getCoverageChange } from "./_utils/coverage-change";
import {
  getListeningPastBasicsEffect,
  withoutPastBasicsAreas,
} from "./_utils/level-listening-starts";
import { loadPlanAtToken } from "./_utils/plan-token";
import { computePlan } from "./_utils/replan";
import { afterPlanInputWrite } from "./plan-conflict";

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
  await afterPlanInputWrite(async () => {
    const loaded = await loadPlanAtToken(goalId, { now, timeZone });

    if (!loaded || !isPlanReady(loaded)) {
      return;
    }

    const added = pastBasicsAreas.filter((area) =>
      loaded.state.settings.pastBasicsAreas.includes(area),
    );

    const context = {
      ...loaded,
      state: withoutPastBasicsAreas({ areas: added, state: loaded.state }),
    };

    const computed = await computePlan({ context, mode: "forced", now, state: loaded.state });

    if (computed.inputsKey === context.plan.inputsKey) {
      return;
    }

    await commitPlan({
      change: getCoverageChange({
        computed,
        ...getListeningPastBasicsEffect({ areas: added, state: context.state }),
      }),
      computed,
      context,
      extraWrites: (tx) =>
        keepOpenSessionSelection(tx, { goalId, planVersion: context.plan.version + 1 }),
    });
  });
}
