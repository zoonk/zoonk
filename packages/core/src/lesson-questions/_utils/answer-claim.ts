import "server-only";
import { type LessonQuestionPriorTurn } from "@zoonk/ai/tasks/lessons/question";
import { type TransactionClient, type TutorSharedAnswer } from "@zoonk/db";
import { parseLessonQuestionContextSnapshot } from "./context-snapshot-schema";
import { lessonQuestionResourceOmit } from "./question-resource";
import { isSuggestedScreenQuestion } from "./request-fingerprint";
import { getSharedAnswerKey } from "./shared-answers";
import { lockLessonQuestionThread } from "./thread-lock";

const MAX_PRIOR_TURNS = 12;
const STALE_GENERATION_MILLISECONDS = 2 * 60 * 1000;

export type ClaimLessonQuestionAnswerInput = { questionId: string; requestedModel: string };

function getStaleGenerationBoundary(now: Date): Date {
  return new Date(now.getTime() - STALE_GENERATION_MILLISECONDS);
}

function isQuestionClaimable({
  now,
  question,
}: {
  now: Date;
  question: { status: "completed" | "failed" | "pending" | "running"; updatedAt: Date };
}): boolean {
  if (question.status === "pending" || question.status === "failed") {
    return true;
  }

  return question.status === "running" && question.updatedAt < getStaleGenerationBoundary(now);
}

function toPriorTurns(
  questions: { answer: string | null; question: string }[],
): LessonQuestionPriorTurn[] {
  return questions
    .toReversed()
    .flatMap((question) =>
      question.answer ? [{ answer: question.answer, question: question.question }] : [],
    );
}

/** Questions about the same step share turns and wait for each other. */
function sameStepWhere(question: { libraryStepId: string | null }) {
  return { libraryStepId: question.libraryStepId };
}

async function getPriorTurns({
  createdAt,
  questionId,
  step,
  threadId,
  transaction,
}: {
  createdAt: Date;
  questionId: string;
  step: { libraryStepId: string | null };
  threadId: string;
  transaction: TransactionClient;
}) {
  const questions = await transaction.lessonQuestion.findMany({
    omit: lessonQuestionResourceOmit,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MAX_PRIOR_TURNS,
    where: {
      OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: questionId } }],
      answer: { not: null },
      status: "completed",
      ...sameStepWhere(step),
      threadId,
    },
  });

  return toPriorTurns(questions);
}

async function hasBlockingQuestion({
  question,
  transaction,
}: {
  question: { createdAt: Date; id: string; libraryStepId: string | null; threadId: string };
  transaction: TransactionClient;
}) {
  const [earlierUnfinishedQuestion, otherRunningQuestion] = await Promise.all([
    transaction.lessonQuestion.findFirst({
      omit: lessonQuestionResourceOmit,
      where: {
        OR: [
          { createdAt: { lt: question.createdAt } },
          { createdAt: question.createdAt, id: { lt: question.id } },
        ],
        status: { not: "completed" },
        ...sameStepWhere(question),
        threadId: question.threadId,
      },
    }),
    transaction.lessonQuestion.findFirst({
      omit: lessonQuestionResourceOmit,
      where: {
        id: { not: question.id },
        status: "running",
        ...sameStepWhere(question),
        threadId: question.threadId,
      },
    }),
  ]);

  return Boolean(earlierUnfinishedQuestion || otherRunningQuestion);
}

/** Claims only the revision that was read, while it's still unanswered or abandoned. */
function getClaimWhere({
  now,
  question,
  userId,
}: {
  now: Date;
  question: { generationRevision: number; id: string };
  userId: string;
}) {
  return {
    OR: [
      { status: { in: ["pending" as const, "failed" as const] } },
      { status: "running" as const, updatedAt: { lt: getStaleGenerationBoundary(now) } },
    ],
    generationRevision: question.generationRevision,
    id: question.id,
    thread: { userId },
  };
}

/**
 * Someone already asked this on the same screen: the question is answered with the shared answer
 * and the run that wrote it, with no new generation.
 */
async function completeWithSharedAnswer({
  question,
  shared,
  transaction,
  where,
}: {
  question: { id: string };
  shared: TutorSharedAnswer;
  transaction: TransactionClient;
  where: ReturnType<typeof getClaimWhere>;
}) {
  const completed = await transaction.lessonQuestion.updateMany({
    data: {
      answer: shared.answer,
      finishReason: null,
      generatedAt: shared.generatedAt,
      generationRevision: { increment: 1 },
      inputTokens: null,
      model: shared.model,
      outputTokens: null,
      promptVersion: shared.promptVersion,
      provider: null,
      requestedModel: null,
      runId: shared.runId,
      sharedAnswerId: shared.id,
      status: "completed",
      totalTokens: null,
    },
    where,
  });

  if (completed.count === 0) {
    return { status: "conflict" as const };
  }

  return { answer: shared.answer, questionId: question.id, status: "shared" as const };
}

export async function claimAnswerInTransaction({
  input,
  now,
  transaction,
  userId,
}: {
  input: ClaimLessonQuestionAnswerInput;
  now: Date;
  transaction: TransactionClient;
  userId: string;
}) {
  const questionOwner = await transaction.lessonQuestion.findFirst({
    omit: lessonQuestionResourceOmit,
    where: { id: input.questionId, thread: { userId } },
  });

  if (!questionOwner) {
    return { status: "notFound" as const };
  }

  await lockLessonQuestionThread({ threadId: questionOwner.threadId, transaction });

  const question = await transaction.lessonQuestion.findUniqueOrThrow({
    where: { id: questionOwner.id },
  });

  if (!isQuestionClaimable({ now, question })) {
    return { status: "conflict" as const };
  }

  if (await hasBlockingQuestion({ question, transaction })) {
    return { status: "conflict" as const };
  }

  const priorTurns = await getPriorTurns({
    createdAt: question.createdAt,
    questionId: question.id,
    step: question,
    threadId: question.threadId,
    transaction,
  });

  const sharedKey = getSharedAnswerKey({ hasPriorTurns: priorTurns.length > 0, question });
  const claimWhere = getClaimWhere({ now, question, userId });

  const shared = sharedKey
    ? await transaction.tutorSharedAnswer.findUnique({ where: { stepQuestion: sharedKey } })
    : null;

  if (shared) {
    return completeWithSharedAnswer({ question, shared, transaction, where: claimWhere });
  }

  const claimed = await transaction.lessonQuestion.updateMany({
    data: {
      answer: null,
      finishReason: null,
      generatedAt: null,
      generationRevision: { increment: 1 },
      inputTokens: null,
      model: null,
      outputTokens: null,
      promptVersion: null,
      provider: null,
      requestedModel: input.requestedModel,
      runId: null,
      status: "running",
      totalTokens: null,
    },
    where: claimWhere,
  });

  if (claimed.count === 0) {
    return { status: "conflict" as const };
  }

  return {
    claim: {
      contextSnapshot: parseLessonQuestionContextSnapshot(question.contextSnapshot),
      priorTurns,
      question: question.question,
      questionId: question.id,
      revision: question.generationRevision + 1,
      /** A first question about a screen may be answered once for everyone who asks it there. */
      sharing: sharedKey && { key: sharedKey, suggested: isSuggestedScreenQuestion(question) },
    },
    status: "ready" as const,
  };
}
