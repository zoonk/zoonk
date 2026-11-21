import "server-only";
import { type TransactionClient } from "@zoonk/db";
import {
  keepOpenSessionSelection,
  skipTestedOutBlocks,
} from "../sessions/_utils/skip-tested-out-blocks";
import { isPlanReady } from "./_utils/apply-plan-change";
import { commitPlan } from "./_utils/commit-plan";
import { followPlanToday } from "./_utils/follow-plan-today";
import {
  getListeningPastBasicsEffect,
  withPastBasicsAreas,
  withoutPastBasicsAreas,
} from "./_utils/level-listening-starts";
import {
  listChangeTopics,
  loadLivingPlanBatch,
  mergeChangeTopics,
} from "./_utils/living-plan-change";
import { toPlanChangePayload } from "./_utils/plan-change-payload";
import { loadPlanAtToken } from "./_utils/plan-token";
import { computePlan } from "./_utils/replan";
import { countLessons } from "./_utils/stand-in-lessons";
import { commitTestedOutBatch, findUnseenSkip } from "./_utils/tested-out-batch";
import { withPlanRetry } from "./plan-conflict";

/** For logs and admin only; the apps word it as "Skipped 12 lessons you already know". */
const TESTED_OUT_NOTE = "Placement or a test-out skipped lessons the learner already knows.";

export async function announceTestedOutItems({
  extraWrites,
  followToday = false,
  goalId,
  livingPlanDay,
  mergeWithUnseen = true,
  now,
  pastBasicsAdded = [],
  pastBasicsAreas = [],
  planItemIds,
  skipBlocks = false,
  timeZone,
}: {
  extraWrites?: (tx: TransactionClient) => Promise<unknown>;
  /**
   * True for a test the learner took on its own; an answer inside today's session keeps the rest of
   * the day as shown.
   */
  followToday?: boolean;
  goalId: string;
  livingPlanDay?: string;
  mergeWithUnseen?: boolean;
  now: Date;
  pastBasicsAdded?: readonly string[];
  pastBasicsAreas?: readonly string[];
  planItemIds: readonly string[];
  /** Shared notices save every goal's undo snapshot before pending blocks are skipped. */
  skipBlocks?: boolean;
  timeZone: string;
}): Promise<{ changeId: string | null; lessonsSkipped: number; planVersion: number } | null> {
  if (planItemIds.length === 0) {
    return null;
  }

  const skipped = new Set(planItemIds);

  return withPlanRetry(async () => {
    const loaded = await loadPlanAtToken(goalId, { now, timeZone });

    if (!loaded || !isPlanReady(loaded)) {
      return null;
    }

    const startsAdded = pastBasicsAdded.filter((area) =>
      loaded.state.settings.pastBasicsAreas.includes(area),
    );

    const context = {
      ...loaded,
      state: withoutPastBasicsAreas({ areas: startsAdded, state: loaded.state }),
    };

    const lessonsSkipped = countLessons(context.items.filter((item) => skipped.has(item.id)));

    const existing = livingPlanDay
      ? await loadLivingPlanBatch({ context, day: livingPlanDay })
      : await findUnseenSkip({ context, now });

    if (
      existing &&
      !extraWrites &&
      pastBasicsAreas.length === 0 &&
      startsAdded.length === 0 &&
      planItemIds.every((id) => existing.payload.planItemIds.includes(id))
    ) {
      if (skipBlocks) {
        await skipTestedOutBlocks({ goalId, notStarted: !followToday, planItemIds });
      }

      if (followToday) {
        await followPlanToday({ changeId: existing.change.id, context });
      }

      return { changeId: existing.change.id, lessonsSkipped, planVersion: context.plan.version };
    }

    const unseen = livingPlanDay || mergeWithUnseen ? existing : null;

    const save = async (tx: TransactionClient) => {
      await extraWrites?.(tx);

      if (!followToday && !skipBlocks) {
        await keepOpenSessionSelection(tx, { goalId, planVersion: context.plan.version + 1 });
      }
    };

    const computed = await computePlan({
      context,
      mode: "forced",
      now,
      state: withPastBasicsAreas({ areas: pastBasicsAreas, state: loaded.state }),
    });

    const skippedTopics = livingPlanDay
      ? listChangeTopics({
          graph: context.state.graph,
          skillIds: new Set(
            context.items.flatMap((item) =>
              skipped.has(item.id) && item.skillId ? [item.skillId] : [],
            ),
          ),
        })
      : undefined;

    const effect = {
      ...computed.effect,
      ...(skippedTopics && {
        topicsLeftOut: mergeChangeTopics(computed.effect.topicsLeftOut, skippedTopics),
      }),
      ...getListeningPastBasicsEffect({
        areas: [...pastBasicsAreas, ...startsAdded],
        state: context.state,
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
          change: {
            kind: "testedOut",
            payload: toPlanChangePayload({
              effect,
              lessonsSkipped,
              ...(livingPlanDay && { livingPlanDay, todaySession: "unchanged" }),
              planItemIds: [...skipped],
              source: "system",
            }),
            reason: TESTED_OUT_NOTE,
            status: "applied",
          },
          computed,
          context,
          extraWrites: save,
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
