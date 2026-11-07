import { type GenerationStatus, type Goal, type TransactionClient, prisma } from "@zoonk/db";
import "server-only";
import { getOutlineStaleBefore } from "../../lookahead/outline-ahead";
import { listDayStandIns } from "../../lookahead/outline-window";
import { readSkillCourses } from "../../lookahead/plan-outline-needs";

const OUTLINING: GenerationStatus[] = ["pending", "running"];
const ENDED: GenerationStatus[] = ["completed", "failed"];

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

export async function areDayLessonsComing({
  askedAt = null,
  client = prisma,
  courseIds,
  now = new Date(),
}: {
  askedAt?: Date | null;
  client?: TransactionClient;
  courseIds: readonly string[];
  now?: Date;
}): Promise<boolean> {
  if (courseIds.length === 0) {
    return false;
  }

  if (askedAt && askedAt > getOutlineStaleBefore(now)) {
    const ended = await client.course.count({
      where: {
        id: { in: [...courseIds] },
        outlineStatus: { in: ENDED },
        updatedAt: { gte: askedAt },
      },
    });

    return ended < courseIds.length;
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

/**
 * Whether the day's stand-ins are getting lessons (`awaiting`) or wait for someone to ask (`idle`);
 * null without stand-ins. They're getting lessons while an outline is writing a course they need or
 * the learner's fresh ask has not had all its outlines end yet.
 */
export async function getDayOutlines(input: DayOutlinesInput): Promise<DayOutlines> {
  const { client = prisma, goal, now = new Date() } = input;
  const courseIds = await loadDayStandInCourseIds(input);

  if (courseIds.length === 0) {
    return null;
  }

  const plan = await client.plan.findUnique({
    select: { lessonsAskedAt: true },
    where: { goalId: goal.id },
  });

  return (await areDayLessonsComing({ askedAt: plan?.lessonsAskedAt, client, courseIds, now }))
    ? "awaiting"
    : "idle";
}
