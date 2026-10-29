import {
  type GenerationStatus,
  type Goal,
  type PlanItem,
  type TransactionClient,
  prisma,
} from "@zoonk/db";
import "server-only";
import { getOutlineStaleBefore } from "../../lookahead/outline-ahead";
import { readSkillCourses } from "../../lookahead/plan-outline-needs";
import { isStandIn } from "../../plans/planner/plan-item-rules";
import { isExamSchedule } from "../../plans/planner/plan-queue";

export const OUTLINING: GenerationStatus[] = ["pending", "running"];

export type DayOutlines = "awaiting" | "idle" | null;

const STAND_IN = {
  chapterId: null,
  kind: "lesson",
  lessonId: null,
  skillId: { not: null },
} as const;

/** A long stand-in may start today while its due date is later; detect its consumed interval. */
async function loadNextStandIn({
  client,
  goal,
  localDate,
  until,
}: {
  client: TransactionClient;
  goal: Pick<Goal, "id" | "kind" | "targetDate">;
  localDate: Date;
  until?: Date;
}): Promise<Pick<PlanItem, "skillId">[]> {
  if (isExamSchedule(goal)) {
    return [];
  }

  const plan = { goalId: goal.id };

  const [last, next] = await Promise.all([
    client.planItem.findFirst({
      orderBy: [{ scheduledFor: "desc" }, { position: "desc" }],
      select: { kind: true },
      where: { plan, scheduledFor: { lte: localDate }, status: "todo" },
    }),
    client.planItem.findFirst({
      orderBy: [{ scheduledFor: "asc" }, { position: "asc" }],
      select: { chapterId: true, kind: true, lessonId: true, skillId: true },
      where: { plan, scheduledFor: { gt: localDate, lte: until }, status: "todo" },
    }),
  ]);

  return next && isStandIn(next) && last?.kind !== "boss" ? [next] : [];
}

async function loadDayStandInSkills({
  client,
  goal,
  localDate,
  until,
}: {
  client: TransactionClient;
  goal: Pick<Goal, "id" | "kind" | "targetDate">;
  localDate: Date;
  until?: Date;
}): Promise<string[]> {
  const [due, next] = await Promise.all([
    client.planItem.findMany({
      select: { skillId: true },
      where: {
        ...STAND_IN,
        plan: { goalId: goal.id },
        scheduledFor: { lte: localDate },
        status: "todo",
      },
    }),
    loadNextStandIn({ client, goal, localDate, until }),
  ]);

  return [...due, ...next].flatMap((item) => (item.skillId ? [item.skillId] : []));
}

type DayOutlinesInput = {
  client?: TransactionClient;
  graph?: unknown;
  goal: Pick<Goal, "id" | "kind" | "primaryCourseId" | "targetDate">;
  /** The learner-local date of the day, as a UTC-midnight label. */
  localDate: Date;
  now?: Date;
  /** The last day the caller's preparation outlines: a later next stand-in is left out. */
  until?: Date;
};

export async function loadDayStandInCourseIds({
  client = prisma,
  goal,
  graph,
  localDate,
  until,
}: DayOutlinesInput): Promise<string[]> {
  const [skillIds, plan] = await Promise.all([
    loadDayStandInSkills({ client, goal, localDate, until }),
    graph === undefined
      ? client.plan.findUnique({ select: { graph: true }, where: { goalId: goal.id } })
      : { graph },
  ]);

  if (!plan || skillIds.length === 0) {
    return [];
  }

  const courseOf = readSkillCourses({ graph: plan.graph, primaryCourseId: goal.primaryCourseId });

  return [
    ...new Set(skillIds.flatMap((skillId) => courseOf.get(skillId) ?? goal.primaryCourseId ?? [])),
  ];
}

/**
 * Whether the day's stand-ins are being outlined (`awaiting`) or wait for someone to ask (`idle`);
 * null without stand-ins. A stand-in reserves time only while its course is actively awaiting an
 * outline; never wait on content nobody is writing.
 */
export async function getDayOutlines(input: DayOutlinesInput): Promise<DayOutlines> {
  const { client = prisma, now = new Date() } = input;
  const courseIds = await loadDayStandInCourseIds(input);

  if (courseIds.length === 0) {
    return null;
  }

  const outlining = await client.course.count({
    where: {
      id: { in: courseIds },
      outlineStatus: { in: OUTLINING },
      updatedAt: { gt: getOutlineStaleBefore(now) },
    },
  });

  return outlining > 0 ? "awaiting" : "idle";
}

export async function isDayAwaitingOutlines(input: DayOutlinesInput): Promise<boolean> {
  return (await getDayOutlines(input)) === "awaiting";
}
