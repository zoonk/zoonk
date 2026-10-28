import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";

/** Grading has a per-question cap instead of spending small AI help, since opened lessons already bound it. */
const MAX_MODEL_GRADED_ANSWERS_PER_DAY = 5;

type AnsweredQuestion = { itemId: string } | { stepId: string };

/** Uses a rolling 24-hour window. */
export async function canGradeWithModel({
  question,
  userId,
}: {
  question: AnsweredQuestion;
  userId: string;
}): Promise<boolean> {
  const answers = await prisma.attempt.count({
    where: { answeredAt: { gte: new Date(Date.now() - MS_PER_DAY) }, userId, ...question },
  });

  return answers < MAX_MODEL_GRADED_ANSWERS_PER_DAY;
}
