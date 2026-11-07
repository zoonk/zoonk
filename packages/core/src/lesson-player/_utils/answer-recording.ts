import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { loadProgressSince } from "./lesson-runs";

/** Allow the first answer, a self-correction and the end-of-lesson retry. */
const MAX_ANSWERS_PER_STEP_IN_PROGRESS_WINDOW = 3;

export async function findClosingAnswer({
  attemptId,
  client = prisma,
  lessonId,
  stepId,
  until,
  userId,
}: {
  attemptId?: string;
  client?: TransactionClient;
  lessonId: string;
  stepId: string;
  until: Date;
  userId: string;
}): Promise<string | null> {
  const since = await loadProgressSince({ client, lessonId, until, userId });

  const answers = await client.attempt.findMany({
    orderBy: [{ isCorrect: "desc" }, { answeredAt: "desc" }, { id: "desc" }],
    select: { id: true, isCorrect: true },
    take: MAX_ANSWERS_PER_STEP_IN_PROGRESS_WINDOW,
    where: {
      answeredAt: { gte: since },
      stepId,
      userId,
      ...(attemptId && { id: { not: attemptId } }),
    },
  });

  return (
    answers.find((answer) => answer.isCorrect)?.id ??
    (answers.length >= MAX_ANSWERS_PER_STEP_IN_PROGRESS_WINDOW ? (answers[0]?.id ?? null) : null)
  );
}
