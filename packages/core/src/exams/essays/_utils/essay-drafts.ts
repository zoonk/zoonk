import "server-only";
import { prisma } from "@zoonk/db";
import { type EssayDraft, essayAnswerSchema } from "../essay-contract";

/** Essays a learner can have graded in a day: plenty to write and rewrite, bounded for cost. */
const DAILY_ESSAY_GRADES = 6;

/** The block's graded drafts, latest first. */
export async function loadEssayDrafts({
  itemId,
  sessionId,
  userId,
}: {
  itemId: string;
  sessionId: string;
  userId: string;
}): Promise<EssayDraft[]> {
  const attempts = await prisma.attempt.findMany({
    orderBy: { answeredAt: "desc" },
    select: { answer: true, answeredAt: true },
    where: { itemId, studySessionId: sessionId, userId },
  });

  return attempts.flatMap((attempt) => {
    const answer = essayAnswerSchema.safeParse(attempt.answer).data;

    return answer
      ? [{ grade: answer.grade, submittedAt: attempt.answeredAt.toISOString(), text: answer.text }]
      : [];
  });
}

/** Essay grades the learner has left today, on their local day. */
export async function countGradesLeft({
  localDate,
  userId,
}: {
  localDate: Date;
  userId: string;
}): Promise<number> {
  const graded = await prisma.attempt.count({
    where: { item: { format: "essay" }, localDate, userId },
  });

  return Math.max(0, DAILY_ESSAY_GRADES - graded);
}
