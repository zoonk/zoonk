import "server-only";
import { prisma } from "@zoonk/db";
import { getGoalsCacheTag, getLearningProfileCacheTag } from "../../cache/tags";
import { findActiveGoalId } from "../../goals/_utils/goal-view";

function selectLessonPlan(lessonId: string) {
  return {
    goal: { select: { details: true, id: true } },
    id: true,
    items: { select: { chapterId: true }, where: { lessonId } },
    settings: true,
  } as const;
}

/** A private read that calls `findLearnerLessonPlan` carries these, which plan and goal writes and a switch of active goal expire. */
export function getLearnerLessonPlanCacheTags(userId: string): string[] {
  return [getGoalsCacheTag(userId), getLearningProfileCacheTag(userId)];
}

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
