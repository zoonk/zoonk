import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import {
  keepOpenSessionSelection,
  skipTestedOutBlocks,
} from "../sessions/_utils/skip-tested-out-blocks";
import { isPlanReady } from "./_utils/apply-plan-change";
import { commitPlan } from "./_utils/commit-plan";
import { followPlanToday } from "./_utils/follow-plan-today";
import {
  listChangeTopics,
  loadLivingPlanBatch,
  mergeChangeTopics,
} from "./_utils/living-plan-change";
import { parsePlanChangePayload, toPlanChangePayload } from "./_utils/plan-change-payload";
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
  testReceipt,
}: {
  context: PlanContext;
  livingPlanDay?: string;
  now: Date;
  testReceipt?: string;
}) {
  if (livingPlanDay) {
    return loadLivingPlanBatch({ context, day: livingPlanDay });
  }

  return testReceipt ? null : findUnseenSkip({ context, now });
}

export async function announceTestedOutItems({
  extraWrites,
  followToday = false,
  goalId,
  livingPlanDay,
  now,
  planItemIds,
  skipBlocks = false,
  testReceipt,
  timeZone,
}: {
  extraWrites?: (tx: TransactionClient, changeId: string | null) => Promise<unknown>;
  /**
   * True for a test the learner took on its own; an answer inside today's session keeps the rest of
   * the day as shown.
   */
  followToday?: boolean;
  goalId: string;
  livingPlanDay?: string;
  now: Date;
  planItemIds: readonly string[];
  /** Shared notices save every goal's undo snapshot before pending blocks are skipped. */
  skipBlocks?: boolean;
  testReceipt?: string;
  timeZone: string;
}): Promise<{ changeId: string | null; lessonsSkipped: number; planVersion: number } | null> {
  if (planItemIds.length === 0) {
    return null;
  }

  const skipped = new Set(planItemIds);

  return withPlanRetry(async () => {
    const context = await loadPlanAtToken(goalId, { now, timeZone });

    if (!context || !isPlanReady(context)) {
      return null;
    }

    if (testReceipt) {
      const recorded = await prisma.planChange.findFirst({
        select: { id: true, payload: true },
        where: {
          kind: "testedOut",
          payload: { equals: testReceipt, path: ["testReceipt"] },
          planId: context.plan.id,
        },
      });

      if (recorded) {
        return {
          changeId: recorded.id,
          lessonsSkipped: parsePlanChangePayload(recorded.payload).lessonsSkipped ?? 0,
          planVersion: context.plan.version,
        };
      }
    }

    const lessonsSkipped = countLessons(context.items.filter((item) => skipped.has(item.id)));

    const unseen = await readSkipBatch({ context, livingPlanDay, now, testReceipt });

    if (
      unseen &&
      !extraWrites &&
      planItemIds.every((id) => unseen.payload.planItemIds.includes(id))
    ) {
      if (skipBlocks) {
        await skipTestedOutBlocks({ goalId, notStarted: !followToday, planItemIds });
      }

      if (followToday) {
        await followPlanToday({ changeId: unseen.change.id, context });
      }

      return { changeId: unseen.change.id, lessonsSkipped, planVersion: context.plan.version };
    }

    const keepSession = !followToday && !skipBlocks;

    const save = async (tx: TransactionClient, changeId: string | null) => {
      await extraWrites?.(tx, changeId);

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
              ...(testReceipt && { testReceipt }),
              ...(keepSession && { todaySession: "unchanged" }),
            }),
            reason: TESTED_OUT_NOTE,
            status: "applied",
          },
          computed,
          context,
        });

    if (skipBlocks) {
      await skipTestedOutBlocks({ goalId, notStarted: !followToday, planItemIds });
    }

    if (followToday) {
      await followPlanToday({ changeId, context });
    }

    return { changeId, lessonsSkipped, planVersion: context.plan.version + 1 };
  });
}
