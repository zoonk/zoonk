import "server-only";
import { prisma } from "@zoonk/db";
import { isPlanReady } from "./_utils/apply-plan-change";
import { commitPlan } from "./_utils/commit-plan";
import { toPlanChangePayload } from "./_utils/plan-change-payload";
import { type PlanContext } from "./_utils/plan-context";
import { loadPlanAtToken } from "./_utils/plan-token";
import { type ComputedPlan, computePlan } from "./_utils/replan";
import { withPlanRetry } from "./plan-conflict";
import { getSkillArea } from "./planner/graph-areas";
import { type AreaTopics } from "./planner/plan-effect";
import { type PlanGraph } from "./planner/plan-state";

/** For logs and admin only; the apps word it from its topics. */
const RELEARN_NOTE = "A miss in practice brought back the lessons of a topic taken as known.";

function listMissedTopics({
  graph,
  skillIds,
}: {
  graph: PlanGraph;
  skillIds: readonly string[];
}): AreaTopics[] {
  const missed = graph.skills.filter((skill) => skillIds.includes(skill.skillId));
  const byArea = Map.groupBy(missed, (skill) => skill.area ?? "");

  return [...byArea].map(([area, skills]) => ({
    area,
    topics: [...new Set(skills.map((skill) => skill.topics?.[0] ?? skill.name))],
  }));
}

function joinTopics(missed: readonly AreaTopics[], seen: readonly AreaTopics[] = []): AreaTopics[] {
  const byArea = new Map(missed.map((entry) => [entry.area, [...entry.topics]]));

  for (const { area, topics } of seen) {
    byArea.set(area, [...new Set([...(byArea.get(area) ?? []), ...topics])]);
  }

  return [...byArea].map(([area, topics]) => ({ area, topics }));
}

async function findTestedOutItemIds({
  context,
  skillIds,
}: {
  context: PlanContext;
  skillIds: ReadonlySet<string>;
}): Promise<Set<string>> {
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
  now,
  skillIds,
  timeZone,
}: {
  goalId: string;
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

    if (missed.length === 0) {
      return;
    }

    const ids = await findTestedOutItemIds({ context, skillIds: new Set(missed) });
    const first = await planWithRestored({ context, ids, now });
    const plannedIds = getPlannedIds({ computed: first.computed, ids });

    const { computed, restored } =
      plannedIds.size === ids.size
        ? first
        : await planWithRestored({ context, ids: plannedIds, now });

    const restoredIds = getPlannedIds({ computed, ids: plannedIds });
    const seen = computed.effect;

    await commitPlan({
      change: {
        kind: "relearn",
        payload: toPlanChangePayload({
          carriedItemIds: [...restoredIds],
          effect: {
            ...seen,
            topicsAdded: joinTopics(
              listMissedTopics({ graph, skillIds: missed }),
              seen.topicsAdded,
            ),
          },
          source: "system",
        }),
        reason: RELEARN_NOTE,
        status: "applied",
      },
      computed,
      context: restored,
      extraWrites: (tx) =>
        tx.planItem.updateMany({
          data: { completedAt: null, status: "todo" },
          where: { id: { in: [...restoredIds] }, planId: context.plan.id, status: "testedOut" },
        }),
      phaseDates: { mode: "forced", pace: "saved" },
    });
  });
}
