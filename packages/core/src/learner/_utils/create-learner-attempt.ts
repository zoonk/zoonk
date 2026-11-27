import { type Attempt, type MistakeCause, type TransactionClient, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type LearnerAnswer } from "../record-learner-answer";
import { getLocalAnswerTime } from "./local-time";

/** Callers must resolve merged skills before supplying the answer. */
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
      ...(input.attemptId && { id: input.attemptId }),
      answer: input.answer,
      answeredAt,
      durationMs: input.graded.durationMs,
      evidence: input.evidence ?? null,
      focusTestId: input.focusTestId ?? null,
      fromLesson: Boolean(input.stepId) || input.practiceQuestion?.kind === "lesson",
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

export function writeAttemptAttribution({
  attempt,
  cause,
  fixedMistakeIds,
  replayed,
  transaction,
}: {
  attempt: Attempt;
  cause: MistakeCause | null;
  fixedMistakeIds: string[];
  replayed: boolean;
  transaction: TransactionClient;
}): Promise<Attempt> | Attempt {
  const exactReplay = attempt.evidence === "independent" && replayed;
  const answer = isJsonObject(attempt.answer) ? attempt.answer : {};
  const recordAttribution = fixedMistakeIds.length > 0 || "fixedMistakeIds" in answer;

  if (!cause && !exactReplay && !recordAttribution) {
    return attempt;
  }

  return transaction.attempt.update({
    data: {
      ...(recordAttribution ? { answer: { ...answer, fixedMistakeIds } } : {}),
      cause,
      ...(exactReplay ? { evidence: "replay" } : {}),
    },
    where: { id: attempt.id },
  });
}
