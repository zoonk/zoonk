import "server-only";
import { type LessonQuestion, type TransactionClient } from "@zoonk/db";
import { type LessonScreenSuggestion } from "../contract";

export type SharedAnswerKey = { stepId: string; suggestion: LessonScreenSuggestion };

type SharedQuestion = Pick<LessonQuestion, "contextKind" | "libraryStepId" | "suggestion">;

/** Only first-turn screen suggestions can share answers; typed learner text and follow-ups must remain private. */
export function getSharedAnswerKey({
  hasPriorTurns,
  question,
}: {
  hasPriorTurns: boolean;
  question: SharedQuestion;
}): SharedAnswerKey | null {
  if (
    question.contextKind !== "step" ||
    !question.libraryStepId ||
    !question.suggestion ||
    hasPriorTurns
  ) {
    return null;
  }

  return { stepId: question.libraryStepId, suggestion: question.suggestion };
}

/** First writer wins; racing questions link the already-saved shared answer. */
export async function saveSharedAnswer({
  answer,
  key,
  provenance,
  question,
  questionId,
  transaction,
}: {
  answer: string;
  key: SharedAnswerKey;
  provenance: { generatedAt: Date; model: string; promptVersion: string; runId: string };
  question: string;
  questionId: string;
  transaction: TransactionClient;
}) {
  await transaction.tutorSharedAnswer.createMany({
    data: [{ ...key, ...provenance, answer, question }],
    skipDuplicates: true,
  });

  const shared = await transaction.tutorSharedAnswer.findUniqueOrThrow({
    where: { stepSuggestion: key },
  });

  await transaction.lessonQuestion.update({
    data: { sharedAnswerId: shared.id },
    where: { id: questionId },
  });
}
