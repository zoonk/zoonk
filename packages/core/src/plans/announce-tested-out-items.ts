import "server-only";
import { prisma } from "@zoonk/db";
import { isPlanReady } from "./_utils/apply-plan-change";
import { toPlanChangePayload } from "./_utils/plan-change-payload";
import { loadPlanContext } from "./_utils/plan-context";
import { commitPlan, computePlan, withPlanRetry } from "./_utils/replan";
import { countItemLessons } from "./planner/plan-effect";

/** A plain note for logs and admin; the apps say "Skipped 12 lessons you already know". */
const TESTED_OUT_NOTE = "Placement or a test-out skipped lessons the learner already knows.";

/**
 * After placement or a test-out skipped plan items, says so on the plan ("Skipped 12 lessons you
 * already know", with an undo) and re-plans from today, so the time those lessons would have
 * taken goes to what comes next.
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
}): Promise<void> {
  if (planItemIds.length === 0) {
    return;
  }

  await withPlanRetry(async () => {
    const goal = await prisma.goal.findUnique({ where: { id: goalId } });
    const context = goal ? await loadPlanContext({ goal, now, timeZone }) : null;

    if (!context || !isPlanReady(context)) {
      return;
    }

    const ids = new Set(planItemIds);
    const computed = await computePlan({ context, mode: "forced", now });

    await commitPlan({
      change: {
        kind: "testedOut",
        payload: toPlanChangePayload({
          effect: computed.effect,
          lessons: context.items
            .filter((item) => ids.has(item.id) && item.kind === "lesson")
            .reduce(
              (total, item) =>
                total + countItemLessons({ item, standInLessons: computed.standInLessons }),
              0,
            ),
          planItemIds: [...ids],
          source: "system",
        }),
        reason: TESTED_OUT_NOTE,
        status: "applied",
      },
      computed,
      context,
    });
  });
}
