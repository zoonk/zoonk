import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";

export type ExplainGoal = {
  id: string;
  isGuest: boolean;
  language: string;
  question: string;
  title: string;
  userId: string;
  answered: boolean;
};

/** Internal workflow bridge: the public boundary must already have authorized the goal. */
export async function loadExplainGoal(goalId: string): Promise<ExplainGoal | null> {
  const goal = await prisma.goal.findUnique({
    include: {
      plan: {
        select: {
          items: {
            select: { lesson: { select: { contentStatus: true } } },
            where: { kind: "lesson" },
          },
        },
      },
      user: { select: { isAnonymous: true } },
    },
    where: { id: goalId },
  });

  if (goal?.kind !== "explain") {
    return null;
  }

  const details = isJsonObject(goal.details) ? goal.details : {};

  return {
    answered: (goal.plan?.items ?? []).some((item) => item.lesson?.contentStatus === "completed"),
    id: goal.id,
    isGuest: goal.user.isAnonymous,
    language: goal.language,
    question:
      typeof details.question === "string" && details.question.trim()
        ? details.question
        : goal.prompt,
    title: goal.title,
    userId: goal.userId,
  };
}
