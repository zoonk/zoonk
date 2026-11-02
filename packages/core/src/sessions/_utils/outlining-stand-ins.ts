import { type GenerationStatus, type Goal, type TransactionClient, prisma } from "@zoonk/db";
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

/**
 * Whether the day's stand-ins are getting lessons (`awaiting`) or wait for someone to ask (`idle`);
 * null without stand-ins. They're getting lessons while an outline is writing a course they need or
 * the learner's own ask is fresh. Never wait on content nobody is writing.
 */
export async function getDayOutlines(input: DayOutlinesInput): Promise<DayOutlines> {
  const { client = prisma, goal, now = new Date() } = input;
  const courseIds = await loadDayStandInCourseIds(input);

  if (courseIds.length === 0) {
    return null;
  }

  const staleBefore = getOutlineStaleBefore(now);

  const [outlining, asked] = await Promise.all([
    client.course.count({
      where: {
        id: { in: courseIds },
        outlineStatus: { in: OUTLINING },
        updatedAt: { gt: staleBefore },
      },
    }),
    client.plan.count({ where: { goalId: goal.id, lessonsAskedAt: { gt: staleBefore } } }),
  ]);

  return outlining + asked > 0 ? "awaiting" : "idle";
}

export async function isDayAwaitingOutlines(input: DayOutlinesInput): Promise<boolean> {
  return (await getDayOutlines(input)) === "awaiting";
}
