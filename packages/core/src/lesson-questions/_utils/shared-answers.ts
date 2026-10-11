import "server-only";
import { type LessonQuestion, type TransactionClient } from "@zoonk/db";
import { type LessonScreenSuggestion } from "../contract";

export type SharedAnswerKey = { stepId: string; suggestion: LessonScreenSuggestion };

type SharedQuestion = Pick<LessonQuestion, "contextKind" | "libraryStepId" | "suggestion">;

/**
 * Where a question's shared answer lives, written once for everyone who taps the same suggestion
 * on the screen.
 * Only the tutor's own suggestions about a lesson screen have one, as a first question (a
 * follow-up depends on the conversation before it): whatever a learner types is theirs, answered
 * with what memory knows about them, so shared rows never hold a learner's words.
 */
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

/**
 * Saves an answer as its screen's shared answer and links the question to it. The first writer
 * wins: a learner who raced another one to the same suggestion links the answer already saved.
 */
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
