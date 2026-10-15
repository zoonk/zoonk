import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { skipTestedOutBlocks } from "../sessions/_utils/skip-tested-out-blocks";
import { isPlanReady } from "./_utils/apply-plan-change";
import { followPlanToday } from "./_utils/follow-plan-today";
import { getListeningPastBasicsEffect, withPastBasicsAreas } from "./_utils/level-listening-starts";
import { toPlanChangePayload } from "./_utils/plan-change-payload";
import { loadPlanContext } from "./_utils/plan-context";
import { commitPlan, computePlan } from "./_utils/replan";
import { withSeenTopics } from "./_utils/seen-effect";
import { countLessons } from "./_utils/stand-in-lessons";
import { withPlanRetry } from "./plan-conflict";

/** A plain note for logs and admin; the apps say "Skipped 12 lessons you already know". */
const TESTED_OUT_NOTE = "Placement or a test-out skipped lessons the learner already knows.";

/**
 * After placement or a test-out skipped plan items, says so on the plan ("Skipped 12 lessons you
 * already know", with an undo) and re-plans from today, so the time those lessons would have
 * taken goes to what comes next, today's blocks not started included. Returns the change, so the screen that skipped them can offer
 * its undo right there, and the lessons it skipped as every screen counts them; null when the plan
 * isn't the planner's yet.
 */
export async function announceTestedOutItems({
  extraWrites,
  followToday = true,
  goalId,
  now,
  pastBasicsAreas = [],
  planItemIds,
  timeZone,
}: {
  /** Other writes that must land with the announcement, such as ending the plan setup task it is. */
  extraWrites?: (tx: TransactionClient) => Promise<unknown>;
  /**
   * Today's blocks not started follow the re-plan: true for a test the learner took on its own
   * (placement's end, a chapter test). An answer inside today's session (the first week's
   * placement questions) keeps the rest of the day as the learner was shown it, but for the
   * skipped lessons: Pedro's right answer in his quick review turned his full review the day
   * before his test into a short practice.
   */
  followToday?: boolean;
  goalId: string;
  now: Date;
  /**
   * Areas the same answers start past their basics (see `listPlacementListeningAreas`): they land
   * with the announcement, so its undo takes them back too.
   */
  pastBasicsAreas?: readonly string[];
  planItemIds: readonly string[];
  timeZone: string;
}): Promise<{ changeId: string | null; lessonsSkipped: number } | null> {
  if (planItemIds.length === 0) {
    return null;
  }

  const skipped = new Set(planItemIds);

  return withPlanRetry(async () => {
    const goal = await prisma.goal.findUnique({ where: { id: goalId } });
    const context = goal ? await loadPlanContext({ goal, now, timeZone }) : null;

    if (!context || !isPlanReady(context)) {
      return null;
    }

    const lessonsSkipped = countLessons(context.items.filter((item) => skipped.has(item.id)));

    const computed = await computePlan({
      context,
      mode: "forced",
      now,
      state: withPastBasicsAreas({ areas: pastBasicsAreas, state: context.state }),
    });

    const changeId = await commitPlan({
      change: {
        kind: "testedOut",
        payload: toPlanChangePayload({
          effect: {
            ...withSeenTopics({ computed, shown: context.items }),
            ...getListeningPastBasicsEffect({ areas: pastBasicsAreas, state: context.state }),
          },
          lessonsSkipped,
          planItemIds: [...skipped],
          source: "system",
        }),
        reason: TESTED_OUT_NOTE,
        status: "applied",
      },
      computed,
      context,
      extraWrites,
    });

    // The learner's own answers skipped them, so today skips them too, the lesson they have open
    // included, and the part of today not started follows the plan (or keeps what it showed).
    await skipTestedOutBlocks({ goalId, notStarted: !followToday, planItemIds });

    if (followToday) {
      await followPlanToday({ changeId, context });
    }

    return { changeId, lessonsSkipped };
  });
}
