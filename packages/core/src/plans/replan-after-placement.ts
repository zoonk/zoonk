import "server-only";
import { prisma } from "@zoonk/db";
import { isPlanReady } from "./_utils/apply-plan-change";
import { getCoverageChange } from "./_utils/coverage-change";
import { followPlanToday } from "./_utils/follow-plan-today";
import { getListeningPastBasicsEffect, withPastBasicsAreas } from "./_utils/level-listening-starts";
import { loadPlanContext } from "./_utils/plan-context";
import { commitPlan, computePlan } from "./_utils/replan";
import { withPlanRetry } from "./plan-conflict";

/**
 * Plans again from today once placement ends without skipping anything, when its answers changed
 * what the plan is planned from (what the learner missed, or showed they know): placement exists
 * to shape the plan, and day one is when the learner sees whether it listened. A Câmara learner's
 * true-or-false answers skipped nothing, and the Linguistics topics they had just missed stayed
 * out while topics nobody asked about kept their lessons. As after a skip (see
 * `announceTestedOutItems`), the part of today not started follows, and Today names the topics it
 * moves (see `getCoverageChange`). Answers that change nothing leave the plan as it is.
 */
export async function replanAfterPlacement({
  goalId,
  now,
  pastBasicsAreas = [],
  timeZone,
}: {
  goalId: string;
  now: Date;
  /** Areas the answers start past their basics (see `listPlacementListeningAreas`). */
  pastBasicsAreas?: readonly string[];
  timeZone: string;
}): Promise<void> {
  await withPlanRetry(async () => {
    const goal = await prisma.goal.findUnique({ where: { id: goalId } });
    const context = goal ? await loadPlanContext({ goal, now, timeZone }) : null;

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
        context,
        fromPlacement: true,
        listeningPastBasics: getListeningPastBasicsEffect({
          areas: pastBasicsAreas,
          state: context.state,
        }).listeningPastBasics,
      }),
      computed,
      context,
    });

    await followPlanToday({ changeId, context });
  });
}
