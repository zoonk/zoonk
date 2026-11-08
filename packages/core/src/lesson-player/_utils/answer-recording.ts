import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { loadProgressSince } from "./lesson-runs";

/** Misses on the first answer, a self-correction and the end-of-lesson retry; a right answer after them still counts. */
const MAX_MISSES_PER_STEP_IN_PROGRESS_WINDOW = 3;

/** Leave out `isCorrect` before grading: only a right answer closes the screen then. */
export async function findClosingAnswer({
  attemptId,
  client = prisma,
  isCorrect,
  lessonId,
  stepId,
  until,
  userId,
}: {
  attemptId?: string;
  client?: TransactionClient;
  isCorrect?: boolean;
  lessonId: string;
  stepId: string;
  until: Date;
  userId: string;
}): Promise<string | null> {
  const since = await loadProgressSince({ client, lessonId, until, userId });

  const answers = await client.attempt.findMany({
    orderBy: [{ isCorrect: "desc" }, { answeredAt: "desc" }, { id: "desc" }],
    select: { id: true, isCorrect: true },
    take: MAX_MISSES_PER_STEP_IN_PROGRESS_WINDOW,
    where: {
      answeredAt: { gte: since },
      stepId,
      userId,
      ...(attemptId && { id: { not: attemptId } }),
    },
  });

  const right = answers.find((answer) => answer.isCorrect);

  if (right) {
    return right.id;
  }

  const missedEnough =
    isCorrect === false && answers.length >= MAX_MISSES_PER_STEP_IN_PROGRESS_WINDOW;

  return missedEnough ? (answers[0]?.id ?? null) : null;
}
