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

/** Preserves persona history and this week's work; never calls a model. */
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
