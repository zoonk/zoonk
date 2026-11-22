import "server-only";
import { prisma } from "@zoonk/db";
import { type EssayDraft } from "../essay-contract";
import { writtenAnswerSchema } from "../writing-contract";

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
    select: { answer: true, answeredAt: true, id: true },
    where: { itemId, studySessionId: sessionId, userId },
  });

  return attempts.flatMap((attempt) => {
    const answer = writtenAnswerSchema.safeParse(attempt.answer).data;

    return answer
      ? [
          {
            attemptId: attempt.id,
            grade: answer.grade,
            submittedAt: attempt.answeredAt.toISOString(),
            text: answer.text,
            ...(answer.writingTask && { writingTask: answer.writingTask }),
          },
        ]
      : [];
  });
}
