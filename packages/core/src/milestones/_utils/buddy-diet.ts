import "server-only";
import { prisma } from "@zoonk/db";
import { CAPSULE_LEDGER_KIND } from "../award-milestones";

/**
 * What the buddy ate in a period, all from learner rows: new ideas (skills first studied), reviews
 * (answers in opened capsules) and fixes (mistakes fixed). It's learning, shown as food.
 */
export type BuddyDiet = { fixes: number; newIdeas: number; reviews: number };

export async function loadBuddyDiet({
  from,
  to,
  userId,
}: {
  from: Date;
  to: Date;
  userId: string;
}): Promise<BuddyDiet> {
  const [newIdeas, reviews, fixes] = await Promise.all([
    prisma.learnerSkill.count({
      where: { createdAt: { gte: from, lt: to }, reps: { gt: 0 }, userId },
    }),
    prisma.learningEvent.aggregate({
      _sum: { correctAnswers: true, incorrectAnswers: true },
      where: {
        endedAt: { gte: from, lt: to },
        kind: "review",
        lessonKind: CAPSULE_LEDGER_KIND,
        userId,
      },
    }),
    prisma.mistake.count({ where: { fixedAt: { gte: from, lt: to }, status: "fixed", userId } }),
  ]);

  return {
    fixes,
    newIdeas,
    reviews: (reviews._sum.correctAnswers ?? 0) + (reviews._sum.incorrectAnswers ?? 0),
  };
}
