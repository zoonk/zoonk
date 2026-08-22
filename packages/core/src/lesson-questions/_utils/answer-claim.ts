import "server-only";
import { type LessonQuestionPriorTurn } from "@zoonk/ai/tasks/lessons/question";
import { type TransactionClient } from "@zoonk/db";
import { parseLessonQuestionContextSnapshot } from "./context-snapshot-schema";
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

async function getPriorTurns({
  createdAt,
  questionId,
  threadId,
  transaction,
}: {
  createdAt: Date;
  questionId: string;
  threadId: string;
  transaction: TransactionClient;
}) {
  const questions = await transaction.lessonQuestion.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MAX_PRIOR_TURNS,
    where: {
      OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: questionId } }],
      answer: { not: null },
      status: "completed",
      threadId,
    },
  });

  return toPriorTurns(questions);
}

async function hasBlockingQuestion({
  question,
  transaction,
}: {
  question: { createdAt: Date; id: string; threadId: string };
  transaction: TransactionClient;
}) {
  const [earlierUnfinishedQuestion, otherRunningQuestion] = await Promise.all([
    transaction.lessonQuestion.findFirst({
      where: {
        OR: [
          { createdAt: { lt: question.createdAt } },
          { createdAt: question.createdAt, id: { lt: question.id } },
        ],
        status: { not: "completed" },
        threadId: question.threadId,
      },
    }),
    transaction.lessonQuestion.findFirst({
      where: { id: { not: question.id }, status: "running", threadId: question.threadId },
    }),
  ]);

  return Boolean(earlierUnfinishedQuestion || otherRunningQuestion);
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

  const staleBefore = getStaleGenerationBoundary(now);

  const claimed = await transaction.lessonQuestion.updateMany({
    data: {
      answer: null,
      finishReason: null,
      generationRevision: { increment: 1 },
      inputTokens: null,
      model: null,
      outputTokens: null,
      provider: null,
      requestedModel: input.requestedModel,
      status: "running",
      totalTokens: null,
    },
    where: {
      OR: [
        { status: { in: ["pending", "failed"] } },
        { status: "running", updatedAt: { lt: staleBefore } },
      ],
      generationRevision: question.generationRevision,
      id: question.id,
      thread: { userId },
    },
  });

  if (claimed.count === 0) {
    return { status: "conflict" as const };
  }

  const priorTurns = await getPriorTurns({
    createdAt: question.createdAt,
    questionId: question.id,
    threadId: question.threadId,
    transaction,
  });

  return {
    claim: {
      contextSnapshot: parseLessonQuestionContextSnapshot(question.contextSnapshot),
      priorTurns,
      question: question.question,
      questionId: question.id,
      revision: question.generationRevision + 1,
    },
    status: "ready" as const,
  };
}
