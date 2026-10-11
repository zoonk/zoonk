import "server-only";
import { prisma } from "@zoonk/db";
import { isPlanReady } from "./_utils/apply-plan-change";
import { updatePhaseDatesProposal } from "./_utils/phase-dates-proposal";
import { toPlanChangePayload } from "./_utils/plan-change-payload";
import { type PlanContext, loadPlanContext } from "./_utils/plan-context";
import { type ComputedPlan, commitPlan, computePlan, withPlanRetry } from "./_utils/replan";
import { withSeenTopics } from "./_utils/seen-effect";
import { getSkillArea } from "./planner/graph-areas";
import { type AreaTopics } from "./planner/plan-effect";
import { type PlanGraph } from "./planner/plan-state";

/** A plain note for logs and admin; the apps say "Nucleus is back in your plan" from its topics. */
const RELEARN_NOTE = "A miss in practice brought back the lessons of a topic taken as known.";

/**
 * The topics the learner missed, by area, as the plan's change names them: each skill by the first
 * topic of the material it teaches ("Nucleus"), or by its own name when it names none.
 */
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

/**
 * The topics a relearn brings in, by area: the missed ones first, then the others the plan built
 * again from today brings into the plan the learner sees (see `withSeenTopics`). Naming only the
 * missed one, an OAB plan's legislative process and juvenile offense topics came in unnamed.
 */
function joinTopics(missed: readonly AreaTopics[], seen: readonly AreaTopics[] = []): AreaTopics[] {
  const byArea = new Map(missed.map((entry) => [entry.area, [...entry.topics]]));

  for (const { area, topics } of seen) {
    byArea.set(area, [...new Set([...(byArea.get(area) ?? []), ...topics])]);
  }

  return [...byArea].map(([area, topics]) => ({ area, topics }));
}

/** The tested-out items that teach any of these skills: their own stand-ins, or lessons on them. */
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

/** The plan rebuilt with these tested-out items back to do. */
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

  // A change the learner didn't make keeps the phase end dates they saw (see `keepPhaseEnds`).
  const computed = await computePlan({
    context: restored,
    keepPhaseDates: true,
    mode: "forced",
    now,
  });

  return { computed, restored };
}

/** The restored items the rebuilt plan teaches. */
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
 * Puts back in the plan the lessons of skills the learner was taken to know and then missed (see
 * `SkillClaim`): one right answer frees a topic from its lessons, never from practice, and a miss
 * there makes it a gap the plan teaches first. Lessons a test-out skipped come back to do, and the
 * plan is built again from today, where a gap's lessons come first; today's session keeps its
 * blocks. Plans never change unannounced: Today says which topic came back and why. The caller
 * says which skills the learner was taken to know before the miss (`loadSkillsToRelearn`).
 *
 * Only the lessons the rebuilt plan teaches come back: a lesson that also teaches the missed skill
 * but that the plan counts for another known one (the missed skill learns from other courses)
 * stays tested out, where it would otherwise come back to do and leave the plan at once.
 */
export async function bringBackMissedLessons({
  goalId,
  now,
  skillIds,
  timeZone,
}: {
  goalId: string;
  now: Date;
  /** The skills taken to know that the learner just missed a question on. */
  skillIds: readonly string[];
  timeZone: string;
}): Promise<void> {
  if (skillIds.length === 0) {
    return;
  }

  await withPlanRetry(async () => {
    const goal = await prisma.goal.findUnique({ where: { id: goalId } });
    const context = goal ? await loadPlanContext({ goal, now, timeZone }) : null;

    if (!context || !isPlanReady(context)) {
      return;
    }

    // An area the learner took out stays out: a miss on its skills brings nothing back.
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
    const seen = withSeenTopics({ computed, shown: context.items });

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
    });

    await updatePhaseDatesProposal({
      computed,
      context: restored,
      mode: "forced",
      pace: "saved",
      revalidation: "now",
    });
  });
}
