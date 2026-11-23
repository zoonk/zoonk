import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { keepOpenSessionSelection } from "../sessions/_utils/skip-tested-out-blocks";
import { isPlanReady } from "./_utils/apply-plan-change";
import { commitPlan } from "./_utils/commit-plan";
import { followPlanToday } from "./_utils/follow-plan-today";
import {
  listChangeTopics,
  loadLivingPlanBatch,
  mergeChangeTopics,
} from "./_utils/living-plan-change";
import { toPlanChangePayload } from "./_utils/plan-change-payload";
import { type PlanContext } from "./_utils/plan-context";
import { loadPlanAtToken } from "./_utils/plan-token";
import { computePlan } from "./_utils/replan";
import { countLessons } from "./_utils/stand-in-lessons";
import { commitTestedOutBatch, findUnseenSkip } from "./_utils/tested-out-batch";
import { withPlanRetry } from "./plan-conflict";

/** For logs and admin only; the apps word it as "Skipped 12 lessons you already know". */
const TESTED_OUT_NOTE = "Placement or a test-out skipped lessons the learner already knows.";

function readSkipBatch({
  context,
  livingPlanDay,
  now,
}: {
  context: PlanContext;
  livingPlanDay?: string;
  now: Date;
}) {
  if (livingPlanDay) {
    return loadLivingPlanBatch({ context, day: livingPlanDay });
  }

  return findUnseenSkip({ context, now });
}

export async function announceTestedOutItems({
  extraWrites,
  followToday = false,
  goalId,
  livingPlanDay,
  now,
  planItemIds,
  testedOutAt,
  timeZone,
}: {
  extraWrites?: (
    tx: TransactionClient,
    changeId: string | null,
    outcome: { lessonsSkipped: number; planVersion: number },
  ) => Promise<unknown>;
  /**
   * True for a test the learner took on its own; an answer inside today's session keeps the rest of
   * the day as shown.
   */
  followToday?: boolean;
  goalId: string;
  livingPlanDay?: string;
  now: Date;
  planItemIds: readonly string[];
  /** A resumed submission only announces item transitions it still owns. */
  testedOutAt?: Date;
  timeZone: string;
}): Promise<{ changeId: string | null; lessonsSkipped: number; planVersion: number } | null> {
  if (planItemIds.length === 0) {
    return null;
  }

  const requested = new Set(planItemIds);

  return withPlanRetry(async () => {
    const context = await loadPlanAtToken(goalId, { now, timeZone });

    if (!context || context.goal.status === "archived" || !isPlanReady(context)) {
      return null;
    }

    const items = context.items.filter(
      (item) =>
        requested.has(item.id) &&
        item.status === "testedOut" &&
        (!testedOutAt || item.completedAt?.getTime() === testedOutAt.getTime()),
    );

    if (items.length === 0) {
      return null;
    }

    const skipped = new Set(items.map((item) => item.id));
    const lessonsSkipped = countLessons(items);

    const unseen = await readSkipBatch({ context, livingPlanDay, now });

    if (
      unseen &&
      !extraWrites &&
      items.every(({ id }) => unseen.payload.planItemIds.includes(id))
    ) {
      if (followToday) {
        await followPlanToday({ changeId: unseen.change.id, context });
      }

      return { changeId: unseen.change.id, lessonsSkipped, planVersion: context.plan.version };
    }

    const keepSession = !followToday;

    const save = async (tx: TransactionClient, changeId: string | null) => {
      await extraWrites?.(tx, changeId, { lessonsSkipped, planVersion: context.plan.version + 1 });

      if (keepSession) {
        await keepOpenSessionSelection(tx, { goalId, planVersion: context.plan.version + 1 });
      }
    };

    const computed = await computePlan({ context, mode: "forced", now });

    const skippedTopics = listChangeTopics({
      graph: context.state.graph,
      skillIds: new Set(
        context.items.flatMap((item) =>
          skipped.has(item.id) && item.skillId ? [item.skillId] : [],
        ),
      ),
    });

    const effect = {
      ...computed.effect,
      ...(skippedTopics.length > 0 && {
        topicsLeftOut: mergeChangeTopics(computed.effect.topicsLeftOut, skippedTopics),
      }),
    };

    // Writing the plan drops earlier changes' snapshots, so the one from before the first skip is
    // kept again for the Undo.
    if (unseen) {
      await commitTestedOutBatch({
        computed,
        context,
        effect,
        livingPlanDay,
        save,
        skipped,
        unseen,
      });
    }

    const changeId = unseen
      ? unseen.change.id
      : await commitPlan({
          afterChange: save,
          change: {
            kind: "testedOut",
            payload: toPlanChangePayload({
              effect,
              lessonsSkipped,
              ...(livingPlanDay && { livingPlanDay }),
              planItemIds: [...skipped],
              source: "system",
              ...(keepSession && { todaySession: "unchanged" }),
            }),
            reason: TESTED_OUT_NOTE,
            status: "applied",
          },
          computed,
          context,
        });

    if (followToday) {
      await followPlanToday({ changeId, context });
    }

    return { changeId, lessonsSkipped, planVersion: context.plan.version + 1 };
  });
}
