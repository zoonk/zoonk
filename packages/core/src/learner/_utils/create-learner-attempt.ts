import { type TransactionClient, prisma } from "@zoonk/db";
import { type LearnerAnswer } from "../record-learner-answer";
import { getLocalAnswerTime } from "./local-time";

/** Shared attempt persistence; callers resolve merged skills before supplying the answer. */
export function createLearnerAttempt({
  answeredAt,
  input,
  transaction = prisma,
}: {
  answeredAt: Date;
  input: LearnerAnswer;
  transaction?: TransactionClient;
}) {
  return transaction.attempt.create({
    data: {
      answer: input.answer,
      answeredAt,
      durationMs: input.graded.durationMs,
      isCorrect: input.graded.isCorrect,
      isPlacement: input.isPlacement ?? false,
      itemId: input.itemId ?? null,
      mockExamId: input.mockExamId ?? null,
      score: input.graded.score ?? null,
      skillId: input.skillId ?? null,
      stepId: input.stepId ?? null,
      studySessionId: input.studySessionId ?? null,
      targetLanguage: input.targetLanguage ?? null,
      userId: input.userId,
      ...getLocalAnswerTime({ date: answeredAt, timeZone: input.timeZone }),
    },
  });
}
