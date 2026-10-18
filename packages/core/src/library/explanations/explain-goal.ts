import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";

export type ExplainGoal = {
  id: string;
  /** Asked by a guest: the answer is written, without pictures or a new course to go further. */
  isGuest: boolean;
  language: string;
  /** The question as the learner asked it. */
  question: string;
  title: string;
  userId: string;
  /** Its plan already points at a written explanation, so nothing is redone. */
  answered: boolean;
};

/**
 * What answering an explain goal reads: the question, the language and the learner. Null when the
 * goal no longer exists or isn't an explain question.
 *
 * This is a workflow bridge: the goal id comes from the public boundary that created the goal.
 */
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
