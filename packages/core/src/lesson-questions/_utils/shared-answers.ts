import "server-only";
import { classifyQuestionGenerality } from "@zoonk/ai/tasks/v2/explain/question-generality";
import { type LessonQuestion, type TransactionClient } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { normalizeIdentityText } from "@zoonk/utils/identity-key";
import { logError } from "@zoonk/utils/logger";

/**
 * Common questions are short. A longer one is almost always about the asker's own case, and its
 * key would outgrow the unique index.
 */
const MAX_SHARED_QUESTION_LENGTH = 300;

export type SharedAnswerKey = { normalizedQuestion: string; stepId: string };

type SharedQuestion = Pick<LessonQuestion, "contextKind" | "libraryStepId" | "question">;

/**
 * Where a question's shared answer would live: only a first question about one lesson screen
 * qualifies, since a follow-up depends on the conversation before it.
 */
export function getSharedAnswerKey({
  hasPriorTurns,
  question,
}: {
  hasPriorTurns: boolean;
  question: SharedQuestion;
}): SharedAnswerKey | null {
  if (question.contextKind !== "step" || !question.libraryStepId || hasPriorTurns) {
    return null;
  }

  const normalizedQuestion = normalizeIdentityText(question.question);

  if (!normalizedQuestion || normalizedQuestion.length > MAX_SHARED_QUESTION_LENGTH) {
    return null;
  }

  return { normalizedQuestion, stepId: question.libraryStepId };
}

/**
 * Whether a question's answer can be written once for everyone who asks it on this screen: the
 * tutor's own suggestions are, and a free-text question only when the generality classifier is
 * confident. A personal answer shown to strangers is worse than writing one more, so a failed
 * check keeps the answer personal.
 */
export async function shouldShareAnswer({
  question,
  suggested,
  userId,
}: {
  question: string;
  suggested: boolean;
  userId: string;
}): Promise<boolean> {
  if (suggested) {
    return true;
  }

  const { data, error } = await safeAsync(() =>
    classifyQuestionGenerality({
      analytics: { contentScope: "personal", distinctId: userId },
      question,
    }),
  );

  if (error) {
    logError(`Could not classify a tutor question of learner ${userId}; answering it privately.`);
    return false;
  }

  return data.isGeneral;
}

/**
 * Saves an answer as its screen's shared answer and links the question to it. The first writer
 * wins: a learner who raced another one to the same question links the answer already saved.
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
    where: { stepQuestion: key },
  });

  await transaction.lessonQuestion.update({
    data: { sharedAnswerId: shared.id },
    where: { id: questionId },
  });
}
