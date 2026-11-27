import {
  type GenerationStatus,
  type Goal,
  type Plan,
  type TransactionClient,
  prisma,
} from "@zoonk/db";
import "server-only";
import { getOutlineStaleBefore } from "../../lookahead/outline-ahead";
import { listDayStandIns } from "../../lookahead/outline-window";
import { readSkillCourses } from "../../lookahead/plan-outline-needs";

const OUTLINING: GenerationStatus[] = ["pending", "running"];

export type DayOutlines = "awaiting" | "idle" | null;

type DayOutlinesInput = {
  client?: TransactionClient;
  graph?: unknown;
  goal: Pick<Goal, "id" | "primaryCourseId">;
  /** The learner-local date of the day, as a UTC-midnight label. */
  localDate: Date;
  now?: Date;
};

export async function loadDayStandInCourseIds({
  client = prisma,
  goal,
  graph,
  localDate,
}: DayOutlinesInput): Promise<string[]> {
  const [standIns, plan] = await Promise.all([
    listDayStandIns({ client, goalId: goal.id, localDate }),
    graph === undefined
      ? client.plan.findUnique({ select: { graph: true }, where: { goalId: goal.id } })
      : { graph },
  ]);

  if (!plan || standIns.length === 0) {
    return [];
  }

  const courseOf = readSkillCourses({ graph: plan.graph, primaryCourseId: goal.primaryCourseId });

  return [
    ...new Set(
      standIns.flatMap(({ skillId }) =>
        skillId ? (courseOf.get(skillId) ?? goal.primaryCourseId ?? []) : [],
      ),
    ),
  ];
}

export async function hasOutliningCourses({
  client = prisma,
  courseIds,
  now = new Date(),
}: {
  client?: TransactionClient;
  courseIds: readonly string[];
  now?: Date;
}): Promise<boolean> {
  if (courseIds.length === 0) {
    return false;
  }

  const outlining = await client.course.count({
    where: {
      id: { in: [...courseIds] },
      outlineStatus: { in: OUTLINING },
      updatedAt: { gt: getOutlineStaleBefore(now) },
    },
  });

  return outlining > 0;
}

type OutliningPlan = Pick<Plan, "graph" | "lessonsAskedAt">;

/** A learner's ask can be awaiting preparation even before the day has stand-in courses. */
export async function getDayOutlines({
  client = prisma,
  goal,
  localDate,
  now = new Date(),
  plan: knownPlan,
}: Omit<DayOutlinesInput, "graph"> & { plan?: OutliningPlan | null }): Promise<DayOutlines> {
  const plan =
    knownPlan === undefined
      ? await client.plan.findUnique({
          select: { graph: true, lessonsAskedAt: true },
          where: { goalId: goal.id },
        })
      : knownPlan;

  if (!plan) {
    return null;
  }

  if (plan.lessonsAskedAt && plan.lessonsAskedAt > getOutlineStaleBefore(now)) {
    return "awaiting";
  }

  const courseIds = await loadDayStandInCourseIds({ client, goal, graph: plan.graph, localDate });

  if (courseIds.length === 0) {
    return null;
  }

  return (await hasOutliningCourses({ client, courseIds, now })) ? "awaiting" : "idle";
}
