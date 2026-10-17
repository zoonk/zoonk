import "server-only";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";

/**
 * How many answers to one question a model grades for a learner in a day. Grading isn't counted as
 * small AI help: it must stay right, and the plan's lesson and practice caps already bound it,
 * since each graded answer is to a question the learner was allowed to open. This bound keeps one
 * question answered over and over from being graded without end. Past it, code still recognizes an
 * accepted answer, and anything else is shown as not checked.
 */
const MAX_MODEL_GRADED_ANSWERS_PER_DAY = 5;

/** The lesson screen or the item a written answer is to. */
type AnsweredQuestion = { itemId: string } | { stepId: string };

/** Whether a model may grade another answer to this question today (the last 24 hours). */
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
