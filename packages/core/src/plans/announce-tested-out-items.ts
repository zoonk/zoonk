import "server-only";
import { prisma } from "@zoonk/db";
import { skipTestedOutBlocks } from "../sessions/_utils/skip-tested-out-blocks";
import { isPlanReady } from "./_utils/apply-plan-change";
import { followPlanToday } from "./_utils/follow-plan-today";
import { toPlanChangePayload } from "./_utils/plan-change-payload";
import { loadPlanContext } from "./_utils/plan-context";
import { commitPlan, computePlan, withPlanRetry } from "./_utils/replan";

/** A plain note for logs and admin; the apps say "Skipped 12 lessons you already know". */
const TESTED_OUT_NOTE = "Placement or a test-out skipped lessons the learner already knows.";

/**
 * After placement or a test-out skipped plan items, says so on the plan ("Skipped 12 lessons you
 * already know", with an undo) and re-plans from today, so the time those lessons would have
 * taken goes to what comes next, today's blocks not started included. Returns the change, so the screen that skipped them can offer
 * its undo right there; null when the plan isn't the planner's yet.
 */
export async function announceTestedOutItems({
  goalId,
  now,
  planItemIds,
  timeZone,
}: {
  goalId: string;
  now: Date;
  planItemIds: readonly string[];
  timeZone: string;
}): Promise<string | null> {
  if (planItemIds.length === 0) {
    return null;
  }

  return withPlanRetry(async () => {
    const goal = await prisma.goal.findUnique({ where: { id: goalId } });
    const context = goal ? await loadPlanContext({ goal, now, timeZone }) : null;

    if (!context || !isPlanReady(context)) {
      return null;
    }

    const computed = await computePlan({ context, mode: "forced", now });

    const changeId = await commitPlan({
      change: {
        kind: "testedOut",
        payload: toPlanChangePayload({
          effect: computed.effect,
          planItemIds: [...new Set(planItemIds)],
          source: "system",
        }),
        reason: TESTED_OUT_NOTE,
        status: "applied",
      },
      computed,
      context,
    });

    // The learner's own answers skipped them, so today skips them too, the lesson they have open
    // included, and the part of today not started follows the plan.
    await skipTestedOutBlocks({ goalId, planItemIds });
    await followPlanToday({ changeId, context });

    return changeId;
  });
}
