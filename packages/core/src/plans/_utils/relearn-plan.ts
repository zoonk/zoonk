import "server-only";
import { prisma } from "@zoonk/db";
import { getSkillArea } from "../planner/graph-areas";
import { type PlanState } from "../planner/plan-state";
import { type PlanContext } from "./plan-context";
import { type ComputedPlan, computePlan } from "./replan";

/** Topics in a skipped area stay out of the plan, missed or not. */
export function withoutSkippedAreas({
  skillIds,
  state,
}: {
  skillIds: readonly string[];
  state: PlanState;
}): string[] {
  const { graph, settings } = state;
  const skipped = new Set(settings.skippedAreas);

  const takenOut = new Set(
    graph.skills
      .filter((skill) => skipped.has(getSkillArea({ graph, skill })))
      .map((skill) => skill.skillId),
  );

  return [...new Set(skillIds)].filter((skillId) => !takenOut.has(skillId));
}

export async function findTestedOutItemIds({
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
  openedKeys,
  state,
}: {
  context: PlanContext;
  ids: ReadonlySet<string>;
  now: Date;
  openedKeys?: readonly string[];
  state: PlanState;
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
    ...(openedKeys && { openedKeys, todayShown: true }),
    state,
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
 * A forced re-plan from today, keeping the phase dates, with the tested-out items `ids` back to
 * do. An item the plan has no room for stays tested out. `openedKeys`, the plan items of the day
 * the learner opened, stay whole on today.
 */
export async function planRelearn({
  context,
  ids,
  now,
  openedKeys,
  state = context.state,
}: {
  context: PlanContext;
  ids: ReadonlySet<string>;
  now: Date;
  openedKeys?: readonly string[];
  state?: PlanState;
}): Promise<{ computed: ComputedPlan; restored: PlanContext; restoredIds: Set<string> }> {
  const first = await planWithRestored({ context, ids, now, openedKeys, state });
  const plannedIds = getPlannedIds({ computed: first.computed, ids });

  const { computed, restored } =
    plannedIds.size === ids.size
      ? first
      : await planWithRestored({ context, ids: plannedIds, now, openedKeys, state });

  return { computed, restored, restoredIds: getPlannedIds({ computed, ids: plannedIds }) };
}
