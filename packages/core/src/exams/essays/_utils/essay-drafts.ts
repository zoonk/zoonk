import "server-only";
import { prisma } from "@zoonk/db";
import { type EssayDraft, essayAnswerSchema } from "../essay-contract";

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
