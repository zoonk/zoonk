import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { findOwnedGoal } from "../learner/_utils/owned-goal";
import { readSkillCourses } from "../lookahead/plan-outline-needs";
import { type PlanWatch } from "./plan-changed-since-contract";

/** Lessons are written on another server, whose clock can run a little behind this one. */
const CLOCK_MARGIN_MS = 2000;

const SESSION_DAYS = 2;

export type PlanChangedSinceResult =
  | { changed: boolean; status: "ready" }
  | { status: "notFound" | "unauthorized" };

/** An outline that ends without lessons for this plan ends the wait on them without writing the plan. */
async function countCourseWrites({
  after,
  goal,
}: {
  after: { gt: Date };
  goal: Pick<Goal, "id" | "primaryCourseId">;
}): Promise<number> {
  const plan = await prisma.plan.findUnique({
    select: { graph: true },
    where: { goalId: goal.id },
  });

  const courseIds = new Set(
    readSkillCourses({
      graph: plan?.graph ?? null,
      primaryCourseId: goal.primaryCourseId,
    }).values(),
  );

  if (goal.primaryCourseId) {
    courseIds.add(goal.primaryCourseId);
  }

  return courseIds.size === 0
    ? 0
    : prisma.course.count({ where: { id: { in: [...courseIds] }, updatedAt: after } });
}

/** `since` is the screen's read time in epoch milliseconds. Uncached: screens poll it. */
export async function getPlanChangedSince({
  goalId,
  since,
  watch,
}: {
  goalId: string;
  since: number;
  watch: PlanWatch;
}): Promise<PlanChangedSinceResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const after = { gt: new Date(since - CLOCK_MARGIN_MS) };
  const changedLesson = { lesson: { updatedAt: after } };

  const [plans, courses, sessions] = await Promise.all([
    prisma.plan.count({
      where: {
        OR: [
          { updatedAt: after },
          { items: { some: { OR: [{ updatedAt: after }, changedLesson] } } },
        ],
        goalId,
      },
    }),
    countCourseWrites({ after, goal: owned.goal }),
    watch === "today"
      ? prisma.studySession.count({
          where: {
            OR: [
              { updatedAt: after },
              { blocks: { some: { OR: [{ updatedAt: after }, changedLesson] } } },
            ],
            goalId,
            localDate: { gte: new Date(since - SESSION_DAYS * MS_PER_DAY) },
            userId: owned.userId,
          },
        })
      : 0,
  ]);

  return { changed: plans + courses + sessions > 0, status: "ready" };
}
