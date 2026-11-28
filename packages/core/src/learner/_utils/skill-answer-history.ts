import "server-only";
import { DbNull, type TransactionClient } from "@zoonk/db";

const RECENT_SKILL_ANSWERS = 10;

export async function loadSkillHistory({
  skillId,
  transaction,
  userId,
}: {
  skillId: string | null;
  transaction: TransactionClient;
  userId: string;
}) {
  if (!skillId) {
    return { before: null, recent: { correct: 0, total: 0 } };
  }

  const before = await transaction.learnerSkill.findUnique({
    where: { userSkill: { skillId, userId } },
  });

  const answers = await transaction.attempt.findMany({
    orderBy: { answeredAt: "desc" },
    select: { isCorrect: true },
    take: RECENT_SKILL_ANSWERS,
    where: {
      OR: [
        { evidence: { not: null } },
        { answer: { equals: DbNull, path: ["practiceMistakeId"] } },
      ],
      skillId,
      userId,
    },
  });

  return {
    before,
    recent: { correct: answers.filter((answer) => answer.isCorrect).length, total: answers.length },
  };
}
