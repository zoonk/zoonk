import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { keepOpenSessionSelection } from "../sessions/_utils/skip-tested-out-blocks";
import { isPlanReady } from "./_utils/apply-plan-change";
import { commitPlan } from "./_utils/commit-plan";
import {
  appendLivingPlanBatch,
  listChangeTopics,
  loadLivingPlanBatch,
  mergeChangeTopics,
} from "./_utils/living-plan-change";
import { toPlanChangePayload } from "./_utils/plan-change-payload";
import { type PlanContext } from "./_utils/plan-context";
import { loadPlanAtToken } from "./_utils/plan-token";
import { type ComputedPlan, computePlan } from "./_utils/replan";
import { withPlanRetry } from "./plan-conflict";
import { getSkillArea } from "./planner/graph-areas";

/** For logs and admin only; the apps word it from its topics. */
const RELEARN_NOTE = "A miss in practice brought back the lessons of a topic taken as known.";

async function findTestedOutItemIds({
  context,
  skillIds,
}: {
  context: PlanContext;
  skillIds: ReadonlySet<string>;
}): Promise<Set<string>> {
  if (skillIds.size === 0) {
    return new Set();
  }

  const testedOut = context.items.filter((item) => item.status === "testedOut");
  const lessonIds = testedOut.flatMap((item) => item.lessonId ?? []);

  const taught =
    lessonIds.length > 0
      ? await prisma.lessonSkill.findMany({
          select: { lessonId: true },
          where: { lessonId: { in: lessonIds }, skillId: { in: [...skillIds] } },
        })
      : [];

  const teaching = new Set(taught.map((row) => row.lessonId));

  return new Set(
    testedOut
      .filter(
        (item) =>
          (item.skillId !== null && skillIds.has(item.skillId)) ||
          (item.lessonId !== null && teaching.has(item.lessonId)),
      )
      .map((item) => item.id),
  );
}

async function planWithRestored({
  context,
  ids,
  now,
}: {
  context: PlanContext;
  ids: ReadonlySet<string>;
  now: Date;
}): Promise<{ computed: ComputedPlan; restored: PlanContext }> {
  const items = context.items.map((item) =>
    ids.has(item.id) ? { ...item, completedAt: null, status: "todo" as const } : item,
  );

  const restored = { ...context, items };

  const computed = await computePlan({
    context: restored,
    keepPhaseDates: true,
    mode: "forced",
    now,
  });

  return { computed, restored };
}

function recheckChangeDay(day: string | undefined) {
  return day ? { livingPlanDay: day, todaySession: "unchanged" as const } : {};
}

function getPlannedIds({
  computed,
  ids,
}: {
  computed: ComputedPlan;
  ids: ReadonlySet<string>;
}): Set<string> {
  return new Set(
    computed.built.items.flatMap((item) => (item.id && ids.has(item.id) ? [item.id] : [])),
  );
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

    const { graph, settings } = context.state;
    const skipped = new Set(settings.skippedAreas);

    const takenOut = new Set(
      graph.skills
        .filter((skill) => skipped.has(getSkillArea({ graph, skill })))
        .map((skill) => skill.skillId),
    );

    const missed = skillIds.filter((skillId) => !takenOut.has(skillId));

    const [ids, batch] = await Promise.all([
      findTestedOutItemIds({ context, skillIds: new Set(missed) }),
      livingPlanDay ? loadLivingPlanBatch({ context, day: livingPlanDay }) : null,
    ]);

    if (ids.size === 0) {
      return;
    }

    const first = await planWithRestored({ context, ids, now });
    const plannedIds = getPlannedIds({ computed: first.computed, ids });

    const { computed, restored } =
      plannedIds.size === ids.size
        ? first
        : await planWithRestored({ context, ids: plannedIds, now });

    const restoredIds = getPlannedIds({ computed, ids: plannedIds });

    if (restoredIds.size === 0) {
      return;
    }

    const previous = batch?.payload;

    const effect = {
      ...computed.effect,
      endDateBefore: previous?.effect?.endDateBefore ?? computed.effect.endDateBefore,
      topicsAdded: mergeChangeTopics(
        previous?.effect?.topicsAdded,
        listChangeTopics({ graph, skillIds: new Set(missed) }),
        computed.effect.topicsAdded,
      ),
      topicsLeftOut: mergeChangeTopics(
        previous?.effect?.topicsLeftOut,
        computed.effect.topicsLeftOut,
      ),
    };

    const payload = {
      carriedItemIds: [...new Set([...(previous?.carriedItemIds ?? []), ...restoredIds])],
      effect,
      ...recheckChangeDay(livingPlanDay),
      recheckedSkillIds: [...new Set([...(previous?.recheckedSkillIds ?? []), ...missed])],
      source: "system",
    };

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

    await commitPlan({
      change: batch
        ? null
        : {
            kind: "relearn",
            payload: toPlanChangePayload(payload),
            reason: RELEARN_NOTE,
            status: "applied",
          },
      computed,
      context: restored,
      extraWrites: save,
      phaseDates: { mode: "forced", pace: "saved" },
      snapshotContext: context,
    });
  });
}
