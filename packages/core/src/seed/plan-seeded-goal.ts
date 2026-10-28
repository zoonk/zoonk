import "server-only";
import { type Goal, type PlanItem, prisma } from "@zoonk/db";
import { commitPlan } from "../plans/_utils/commit-plan";
import { parsePlanChangePayload, toPlanChangePayload } from "../plans/_utils/plan-change-payload";
import { loadPlanContext } from "../plans/_utils/plan-context";
import { loadGoalPlannerLessons } from "../plans/_utils/planner-lessons";
import { computePlan } from "../plans/_utils/replan";
import { countLessons } from "../plans/_utils/stand-in-lessons";
import { type PlanGraph, parsePlanGraph } from "../plans/planner/plan-state";
import {
  type PlannerLesson,
  assignLessonSkills,
  getStandInLessons,
} from "../plans/planner/plan-units";

type SeededPlan = { graph: PlanGraph; id: string; items: PlanItem[] };

/**
 * Gives each lesson the persona wrote on its plan the skill the planner counts it for (see
 * `assignLessonSkills`), as the run that planned it saved it: a lesson a chapter shares among
 * several skills counts for one of them, which is the one a test-out of it settles.
 */
async function writeLessonSkills({
  lessons,
  plan,
}: {
  lessons: readonly PlannerLesson[];
  plan: SeededPlan;
}): Promise<PlanItem[]> {
  const teaching = assignLessonSkills({ lessons, skills: plan.graph.skills });

  return Promise.all(
    plan.items.map((item) => {
      const skillId = item.lessonId ? (teaching.get(item.lessonId) ?? null) : item.skillId;

      return skillId === item.skillId
        ? Promise.resolve(item)
        : prisma.planItem.update({ data: { skillId }, where: { id: item.id } });
    }),
  );
}

/** The graph's skills the tested-out lessons teach: a test-out finds the learner knows them all. */
function listTestedOutSkills({
  items,
  lessons,
}: {
  items: readonly PlanItem[];
  lessons: readonly PlannerLesson[];
}): Set<string> {
  const testedOut = new Set(
    items.flatMap((item) => (item.status === "testedOut" && item.lessonId ? [item.lessonId] : [])),
  );

  return new Set(
    lessons.filter((lesson) => testedOut.has(lesson.lessonId)).flatMap((lesson) => lesson.skillIds),
  );
}

/** A test-out's change with the stand-ins it skipped among its items, and the lessons they are. */
function listStandInsOnChange({
  items,
  payload,
  standIns,
}: {
  items: readonly PlanItem[];
  payload: unknown;
  standIns: readonly PlanItem[];
}) {
  const parsed = parsePlanChangePayload(payload);
  const skipped = new Set([...parsed.planItemIds, ...standIns.map((item) => item.id)]);

  return toPlanChangePayload({
    ...parsed,
    lessonsSkipped: countLessons([...items, ...standIns].filter((item) => skipped.has(item.id))),
    planItemIds: [...skipped],
  });
}

/**
 * A test-out also skips the stand-ins of the skills it covered, the part of each skill the Library
 * hasn't written yet (see `markPlanItemsTestedOut`), on the day of its lessons, and its change
 * lists them with the lessons, so its undo would bring them back too.
 */
async function addTestedOutStandIns({
  items,
  lessons,
  plan,
}: {
  items: readonly PlanItem[];
  lessons: readonly PlannerLesson[];
  plan: SeededPlan;
}): Promise<void> {
  const covered = listTestedOutSkills({ items, lessons });
  const testOut = items.find((item) => item.status === "testedOut" && item.lessonId);
  const standIns = getStandInLessons({ lessons, skills: plan.graph.skills });

  const skills = plan.graph.skills.filter(
    (skill) => covered.has(skill.skillId) && (standIns.get(skill.skillId) ?? 0) > 0,
  );

  if (!testOut || skills.length === 0) {
    return;
  }

  const lastPosition = Math.max(...items.map((item) => item.position));

  const created = await prisma.planItem.createManyAndReturn({
    data: skills.map((skill, index) => ({
      completedAt: testOut.completedAt,
      kind: "lesson" as const,
      lessons: standIns.get(skill.skillId) ?? null,
      phase: skill.phase,
      planId: plan.id,
      position: lastPosition + 1 + index,
      scheduledFor: testOut.scheduledFor,
      skillId: skill.skillId,
      status: "testedOut" as const,
      titleSnapshot: skill.name,
    })),
  });

  const changes = await prisma.planChange.findMany({
    where: { kind: "testedOut", planId: plan.id },
  });

  await Promise.all(
    changes.map((change) =>
      prisma.planChange.update({
        data: {
          payload: listStandInsOnChange({ items, payload: change.payload, standIns: created }),
        },
        where: { id: change.id },
      }),
    ),
  );
}

/**
 * Prepares what the persona wrote on its plan the way the app would have saved it: each lesson
 * with the skill it counts for, and a test-out with the stand-ins it skipped.
 */
async function prepareHistory(goal: Goal): Promise<void> {
  const plan = await prisma.plan.findUniqueOrThrow({
    include: { items: true },
    where: { goalId: goal.id },
  });

  const seeded = { graph: parsePlanGraph(plan.graph), id: plan.id, items: plan.items };

  const lessons = await loadGoalPlannerLessons({ goal, graph: seeded.graph, userId: goal.userId });

  const items = await writeLessonSkills({ lessons, plan: seeded });
  await addTestedOutStandIns({ items, lessons, plan: seeded });
}

/**
 * Plans a seeded goal the way the app does, on the day the seed wrote it (`now`): the persona's
 * history and this week's items stay as written, and the planner lays out the rest at the pace
 * the plan saved, as a plan screen refresh would. No model is called.
 */
export async function planSeededGoal({ goalId, now }: { goalId: string; now: Date }) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });

  await prepareHistory(goal);

  const context = await loadPlanContext({ goal, now });

  if (!context) {
    throw new Error(`The seeded goal ${goalId} has no plan.`);
  }

  const computed = await computePlan({ context, mode: "automatic", now });
  await commitPlan({ change: null, computed, context, revalidation: "skip" });
}
