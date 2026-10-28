import "server-only";
import {
  type GenerationStatus,
  type Goal,
  type PlanItem,
  type TransactionClient,
  prisma,
} from "@zoonk/db";
import { readSkillCourses } from "../../lookahead/plan-outline-needs";
import { isExamSchedule } from "../../plans/planner/plan-queue";

/** A course whose outline hasn't been written yet, or is being written now. */
const OUTLINING: GenerationStatus[] = ["pending", "running"];

/** A plan item waiting for its skill's lessons: a stand-in for lessons nobody outlined yet. */
const STAND_IN = {
  chapterId: null,
  kind: "lesson",
  lessonId: null,
  skillId: { not: null },
} as const;

function isStandIn(item: Pick<PlanItem, "chapterId" | "kind" | "lessonId" | "skillId">) {
  return item.kind === "lesson" && !item.lessonId && !item.chapterId && item.skillId !== null;
}

/**
 * Whether the plan's next item after the day starts in the day's time: a stand-in is due the day
 * its time ends, so one longer than what the day has left starts in it and is due on a later day.
 * Carla's first day showed 6 lessons of its hour, and the next skill's lessons joined it 45
 * seconds later without Today saying any were coming. A phase's challenge closes its day, and an
 * exam's study days each open with their own subject, so then the next item starts a new day.
 */
async function loadNextStandIn({
  client,
  goal,
  localDate,
}: {
  client: TransactionClient;
  goal: Pick<Goal, "id" | "kind" | "targetDate">;
  localDate: Date;
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
      where: { plan, scheduledFor: { gt: localDate }, status: "todo" },
    }),
  ]);

  return next && isStandIn(next) && last?.kind !== "boss" ? [next] : [];
}

/** The skills of the stand-ins that take the day's time: those due by it, and the next one. */
async function loadDayStandInSkills({
  client,
  goal,
  localDate,
}: {
  client: TransactionClient;
  goal: Pick<Goal, "id" | "kind" | "targetDate">;
  localDate: Date;
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
    loadNextStandIn({ client, goal, localDate }),
  ]);

  return [...due, ...next].flatMap((item) => (item.skillId ? [item.skillId] : []));
}

/**
 * Whether the goal's day holds time for lessons still being outlined: a stand-in takes the day's
 * time (`loadDayStandInSkills`) and its course's outline is being written (or hasn't started
 * yet), so its lessons land within minutes and join the end of the day (`appendLandedLessons`),
 * which Today says. A stand-in whose course isn't being outlined (its next chapter waits for a
 * later preparation) holds nothing: the day fills as usual instead of waiting on lessons nobody is
 * writing.
 */
export async function isDayAwaitingOutlines({
  client = prisma,
  goal,
  graph,
  localDate,
}: {
  client?: TransactionClient;
  graph?: unknown;
  goal: Pick<Goal, "id" | "kind" | "primaryCourseId" | "targetDate">;
  /** The learner-local date of the day, as a UTC-midnight label. */
  localDate: Date;
}): Promise<boolean> {
  const [skillIds, plan] = await Promise.all([
    loadDayStandInSkills({ client, goal, localDate }),
    graph === undefined
      ? client.plan.findUnique({ select: { graph: true }, where: { goalId: goal.id } })
      : { graph },
  ]);

  if (!plan || skillIds.length === 0) {
    return false;
  }

  const courseOf = readSkillCourses({ graph: plan.graph, primaryCourseId: goal.primaryCourseId });

  // A skill the graph doesn't name a course for is written in the goal's own course.
  const courseIds = [
    ...new Set(skillIds.flatMap((skillId) => courseOf.get(skillId) ?? goal.primaryCourseId ?? [])),
  ];

  const outlining = await client.course.count({
    where: { id: { in: courseIds }, outlineStatus: { in: OUTLINING } },
  });

  return outlining > 0;
}
