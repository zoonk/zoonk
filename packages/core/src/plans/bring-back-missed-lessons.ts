import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { trackTestEvents } from "../analytics/test-events";
import { keepOpenSessionSelection } from "../sessions/_utils/skip-tested-out-blocks";
import { isPlanReady } from "./_utils/apply-plan-change";
import { commitPlan } from "./_utils/commit-plan";
import { loadCourseStarts } from "./_utils/course-starts";
import {
  appendLivingPlanBatch,
  listChangeTopics,
  loadLivingPlanBatch,
  mergeChangeTopics,
} from "./_utils/living-plan-change";
import { type PlanChangePayload, toPlanChangePayload } from "./_utils/plan-change-payload";
import { loadPlanAtToken } from "./_utils/plan-token";
import { findTestedOutItemIds, planRelearn, withoutSkippedAreas } from "./_utils/relearn-plan";
import { type ComputedPlan, type PlanChangeRecord } from "./_utils/replan";
import { withPlanRetry } from "./plan-conflict";
import { type PlanEffect } from "./planner/plan-effect";
import { type PlanGraph } from "./planner/plan-state";

/** For logs and admin only; the apps word it from its topics. */
const RELEARN_NOTE = "A miss in practice brought back the lessons of a topic taken as known.";

function recheckChangeDay(day: string | undefined) {
  return day ? { livingPlanDay: day, todaySession: "unchanged" as const } : {};
}

function restorationEffect({
  effect,
  graph,
  missed,
  previous,
}: {
  effect: PlanEffect;
  graph: PlanGraph;
  missed: readonly string[];
  previous?: PlanChangePayload;
}): PlanEffect {
  return {
    ...effect,
    endDateBefore: previous?.effect?.endDateBefore ?? effect.endDateBefore,
    topicsAdded: mergeChangeTopics(
      previous?.effect?.topicsAdded,
      listChangeTopics({ graph, skillIds: new Set(missed) }),
      effect.topicsAdded,
    ),
    topicsLeftOut: mergeChangeTopics(previous?.effect?.topicsLeftOut, effect.topicsLeftOut),
  };
}

export function getRelearnPayload({
  computed,
  graph,
  livingPlanDay,
  missed,
  previous,
  restoredIds,
}: {
  computed: ComputedPlan;
  graph: PlanGraph;
  livingPlanDay?: string;
  missed: readonly string[];
  previous?: PlanChangePayload;
  restoredIds: ReadonlySet<string>;
}) {
  return {
    carriedItemIds: [...new Set([...(previous?.carriedItemIds ?? []), ...restoredIds])],
    effect: restorationEffect({ effect: computed.effect, graph, missed, previous }),
    ...recheckChangeDay(livingPlanDay),
    recheckedSkillIds: [...new Set([...(previous?.recheckedSkillIds ?? []), ...missed])],
    source: "system" as const,
  };
}

export function toRelearnChange(payload: ReturnType<typeof getRelearnPayload>): PlanChangeRecord {
  return {
    kind: "relearn",
    payload: toPlanChangePayload(payload),
    reason: RELEARN_NOTE,
    status: "applied",
  };
}

/**
 * The caller says which skills the learner was taken to know before the miss
 * (`loadSkillsToRelearn`).
 */
export async function bringBackMissedLessons({
  goalId,
  livingPlanDay,
  now,
  skillIds,
  timeZone,
}: {
  goalId: string;
  livingPlanDay?: string;
  now: Date;
  skillIds: readonly string[];
  timeZone: string;
}): Promise<void> {
  if (skillIds.length === 0) {
    return;
  }

  await withPlanRetry(async () => {
    const context = await loadPlanAtToken(goalId, { now, timeZone });

    if (!context || !isPlanReady(context)) {
      return;
    }

    const { graph } = context.state;
    const missed = withoutSkippedAreas({ skillIds, state: context.state });

    if (missed.length === 0) {
      return;
    }

    const [ids, batch] = await Promise.all([
      findTestedOutItemIds({ context, skillIds: new Set(missed) }),
      livingPlanDay ? loadLivingPlanBatch({ context, day: livingPlanDay }) : null,
    ]);

    if (livingPlanDay && ids.size === 0) {
      return;
    }

    const { computed, restored, restoredIds } = await planRelearn({ context, ids, now });

    if (livingPlanDay && restoredIds.size === 0) {
      return;
    }

    const payload = getRelearnPayload({
      computed,
      graph,
      livingPlanDay,
      missed,
      previous: batch?.payload,
      restoredIds,
    });

    const save = async (tx: TransactionClient) => {
      await tx.planItem.updateMany({
        data: { completedAt: null, status: "todo" },
        where: { id: { in: [...restoredIds] }, planId: context.plan.id, status: "testedOut" },
      });

      if (livingPlanDay) {
        await keepOpenSessionSelection(tx, { goalId, planVersion: context.plan.version + 1 });
      }

      if (batch) {
        await appendLivingPlanBatch({
          batch,
          kind: "relearn",
          payload: { ...payload, versionAfter: context.plan.version + 1 },
          tx,
        });
      }
    };

    const starts =
      restoredIds.size > 0 && context.goal.kind === "learn"
        ? await loadCourseStarts(goalId)
        : new Map();

    await commitPlan({
      change: batch ? null : toRelearnChange(payload),
      computed,
      context: restored,
      extraWrites: save,
      phaseDates: { mode: "forced", pace: "saved" },
      snapshotContext: context,
    });

    trackTestEvents(
      context.goal,
      missed
        .filter((id) => starts.has(id))
        .map((skillId) => ({
          name: "Course Placement Topic Restored",
          properties: { goal_id: goalId, skill_id: skillId },
        })),
    );
  });
}
