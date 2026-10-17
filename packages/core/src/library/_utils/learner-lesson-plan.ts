import "server-only";
import { prisma } from "@zoonk/db";
import { findActiveGoalId } from "../../goals/_utils/goal-view";

function selectLessonPlan(lessonId: string) {
  return {
    goal: { select: { details: true, id: true } },
    id: true,
    items: { select: { chapterId: true }, where: { lessonId } },
    settings: true,
  } as const;
}

/**
 * The plan a learner plays a lesson for: their plan that has the lesson, most recently changed
 * first, or else the plan of their active goal. `items` are that plan's entries for the lesson,
 * with the chapter it sits in there (none for the active goal's plan without the lesson).
 */
export async function findLearnerLessonPlan({
  lessonId,
  userId,
}: {
  lessonId: string;
  userId: string;
}) {
  const select = selectLessonPlan(lessonId);

  const withLesson = await prisma.plan.findFirst({
    orderBy: { updatedAt: "desc" },
    select,
    where: { goal: { userId }, items: { some: { lessonId } } },
  });

  if (withLesson) {
    return withLesson;
  }

  const activeGoalId = await findActiveGoalId(userId);

  return activeGoalId
    ? prisma.plan.findFirst({ select, where: { goal: { userId }, goalId: activeGoalId } })
    : null;
}
