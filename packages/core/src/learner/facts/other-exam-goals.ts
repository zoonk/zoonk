import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../../cache/tags";
import { getExamName } from "../../exams/exam-name";

export type OtherExamGoal = { goalId: string; name: string; lessonIds: string[] };

/** GET-only, after ownership authorization. Holds only the lessons `goalId`'s plan also holds. */
export async function readOtherExamGoals(userId: string, goalId: string): Promise<OtherExamGoal[]> {
  "use cache: private";

  cacheTag(getGoalsCacheTag(userId), getLearnerModelCacheTag(userId));

  const goals = await prisma.goal.findMany({
    include: {
      examBlueprint: { select: { name: true } },
      plan: {
        select: {
          items: {
            select: { lessonId: true },
            where: { kind: "lesson", lesson: { planItems: { some: { plan: { goalId } } } } },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    where: { id: { not: goalId }, kind: "exam", status: { in: ["active", "paused"] }, userId },
  });

  return goals.flatMap((goal) =>
    goal.plan
      ? [
          {
            goalId: goal.id,
            lessonIds: goal.plan.items.flatMap((item) => item.lessonId ?? []),
            name: getExamName({ blueprint: goal.examBlueprint, goal }),
          },
        ]
      : [],
  );
}
