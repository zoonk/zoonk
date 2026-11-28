import "server-only";
import { prisma } from "@zoonk/db";
import { once } from "@zoonk/utils/once";
import { getSkillArea } from "../planner/graph-areas";
import { LEARN_KINDS } from "../planner/plan-item-rules";
import { type PlanState } from "../planner/plan-state";
import { type MockMiss } from "../planner/skill-order";
import { type PlanContext } from "./plan-context";
import { type ComputePlanRequest, type ComputedPlan, computePlan } from "./replan";
import { loadReplanFacts } from "./replan-input";
import { hasTakenChallenge } from "./taken-challenge";

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

  const lessons = testedOut.filter(
    (item) =>
      (item.skillId !== null && skillIds.has(item.skillId)) ||
      (item.lessonId !== null && teaching.has(item.lessonId)),
  );

  const phases = new Set(lessons.map((item) => item.phase));
  const challenges = testedOut.filter((item) => item.kind === "boss" && phases.has(item.phase));
  return new Set([...lessons, ...challenges].map((item) => item.id));
}

function restorePlanItems({
  context,
  ids,
}: {
  context: PlanContext;
  ids: ReadonlySet<string>;
}): PlanContext {
  const items = context.items.map((item) =>
    ids.has(item.id) ? { ...item, completedAt: null, status: "todo" as const } : item,
  );

  return { ...context, items };
}

async function planWithRestored({
  context,
  ids,
  now,
  openedKeys,
  sharedReads,
  state,
}: {
  context: PlanContext;
  ids: ReadonlySet<string>;
  now: Date;
  openedKeys?: readonly string[];
  sharedReads?: ComputePlanRequest["sharedReads"];
  state: PlanState;
}): Promise<{ computed: ComputedPlan; restored: PlanContext }> {
  const restored = restorePlanItems({ context, ids });

  const computed = await computePlan({
    context: restored,
    keepPhaseDates: true,
    mode: "forced",
    now,
    ...(openedKeys && { openedKeys, todayShown: true }),
    sharedReads,
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
  const planned = computed.built.items.filter((item) => item.id && ids.has(item.id));

  const phases = new Set(
    planned.filter((item) => LEARN_KINDS.has(item.kind)).map((item) => item.phase),
  );

  return new Set(
    planned.flatMap((item) =>
      item.id && (item.kind !== "boss" || phases.has(item.phase)) ? [item.id] : [],
    ),
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
  sharedReads,
  state = context.state,
}: {
  context: PlanContext;
  ids: ReadonlySet<string>;
  now: Date;
  openedKeys?: readonly string[];
  sharedReads?: ComputePlanRequest["sharedReads"];
  state?: PlanState;
}): Promise<{ computed: ComputedPlan; restored: PlanContext; restoredIds: Set<string> }> {
  const first = await planWithRestored({ context, ids, now, openedKeys, sharedReads, state });
  const plannedIds = getPlannedIds({ computed: first.computed, ids });

  const { computed, restored } =
    plannedIds.size === ids.size
      ? first
      : await planWithRestored({ context, ids: plannedIds, now, openedKeys, sharedReads, state });

  return { computed, restored, restoredIds: getPlannedIds({ computed, ids: plannedIds }) };
}

/** Both orders use the same facts, including when laying out a smaller set of restored items. */
export function compareMockRelearnPlans({
  misses,
  state,
  ...request
}: Omit<Parameters<typeof planRelearn>[0], "sharedReads"> & {
  misses: ReadonlyMap<string, MockMiss>;
  state: PlanState;
}) {
  const { context, ids, now, openedKeys } = request;

  const sharedReads = {
    facts: once(() =>
      loadReplanFacts({
        context: restorePlanItems({ context, ids }),
        mode: "forced",
        now,
        state: context.state,
        todayShown: openedKeys !== undefined,
      }),
    ),
    hasTakenChallenge: once(() =>
      hasTakenChallenge({ goalId: context.goal.id, userId: context.goal.userId }),
    ),
  };

  return Promise.all([
    planRelearn({ ...request, sharedReads }),
    planRelearn({ ...request, sharedReads: { ...sharedReads, mockMisses: misses }, state }),
  ]);
}
