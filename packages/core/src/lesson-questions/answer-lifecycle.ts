import "server-only";
import { type LessonQuestionAnswerCompletion } from "@zoonk/ai/tasks/lessons/question";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { claimGenerationQuotaIfNeeded } from "../generation-quotas/claim-generation-quota";
import { getSession } from "../users/get-session";
import {
  type ClaimLessonQuestionAnswerInput,
  claimAnswerInTransaction,
} from "./_utils/answer-claim";
import { getLessonQuestionAccess } from "./_utils/question-access";
import { lessonQuestionResourceOmit } from "./_utils/question-resource";

type CompleteLessonQuestionAnswerInput = LessonQuestionAnswerCompletion & {
  questionId: string;
  revision: number;
};

async function getQuestionAnswerAccess({
  questionId,
  userId,
}: {
  questionId: string;
  userId: string;
}) {
  const thread = await prisma.lessonQuestionThread.findFirst({
    where: { questions: { some: { id: questionId } }, userId },
  });

  if (!thread?.lessonId) {
    return { status: "notFound" as const };
  }

  return getLessonQuestionAccess({ lessonId: thread.lessonId, userId });
}

function markClaimedLessonQuestionAnswerFailed({
  questionId,
  revision,
  userId,
}: {
  questionId: string;
  revision: number;
  userId: string;
}) {
  return prisma.lessonQuestion.updateMany({
    data: { status: "failed" },
    where: { generationRevision: revision, id: questionId, status: "running", thread: { userId } },
  });
}

/** Releases the provider-less revision before propagating a quota infrastructure failure. */
async function claimLessonQuestionQuota({
  questionId,
  revision,
  userId,
}: {
  questionId: string;
  revision: number;
  userId: string;
}) {
  try {
    return await claimGenerationQuotaIfNeeded({
      resource: "lessonQuestion",
      shouldClaimQuota: true,
      targetId: questionId,
    });
  } catch (error) {
    await markClaimedLessonQuestionAnswerFailed({ questionId, revision, userId });
    throw error;
  }
}

/** Atomically claims a pending, failed, or abandoned answer generation for its owner. */
export async function claimLessonQuestionAnswer(input: ClaimLessonQuestionAnswerInput) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  if (!isUuid(input.questionId)) {
    return { status: "notFound" as const };
  }

  const access = await getQuestionAnswerAccess({
    questionId: input.questionId,
    userId: session.user.id,
  });

  if (access.status !== "ready") {
    return access;
  }

  const now = new Date();

  const claimed = await prisma.$transaction((transaction) =>
    claimAnswerInTransaction({ input, now, transaction, userId: session.user.id }),
  );

  if (claimed.status !== "ready") {
    return claimed;
  }

  const quota = await claimLessonQuestionQuota({
    questionId: claimed.claim.questionId,
    revision: claimed.claim.revision,
    userId: session.user.id,
  });

  if (quota.status === "ready") {
    return claimed;
  }

  await markClaimedLessonQuestionAnswerFailed({
    questionId: claimed.claim.questionId,
    revision: claimed.claim.revision,
    userId: session.user.id,
  });

  return quota;
}

async function getConditionalWriteOutcome({
  questionId,
  updatedCount,
  userId,
}: {
  questionId: string;
  updatedCount: number;
  userId: string;
}) {
  if (updatedCount > 0) {
    return { status: "updated" as const };
  }

  const exists = await prisma.lessonQuestion.findFirst({
    omit: lessonQuestionResourceOmit,
    where: { id: questionId, thread: { userId } },
  });

  return exists ? { status: "stale" as const } : { status: "notFound" as const };
}

/** Persists a model completion only when it still owns the current generation revision. */
export async function completeLessonQuestionAnswer(input: CompleteLessonQuestionAnswerInput) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  if (!isUuid(input.questionId)) {
    return { status: "notFound" as const };
  }

  const updated = await prisma.lessonQuestion.updateMany({
    data: {
      answer: input.answer,
      finishReason: input.finishReason,
      inputTokens: input.inputTokens ?? null,
      model: input.model,
      outputTokens: input.outputTokens ?? null,
      provider: input.provider,
      status: "completed",
      totalTokens: input.totalTokens ?? null,
    },
    where: {
      generationRevision: input.revision,
      id: input.questionId,
      status: "running",
      thread: { userId: session.user.id },
    },
  });

  return getConditionalWriteOutcome({
    questionId: input.questionId,
    updatedCount: updated.count,
    userId: session.user.id,
  });
}

/** Marks only the current owned generation revision as retryable after a streaming failure. */
export async function failLessonQuestionAnswer({
  questionId,
  revision,
}: {
  questionId: string;
  revision: number;
}) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  if (!isUuid(questionId)) {
    return { status: "notFound" as const };
  }

  const updated = await markClaimedLessonQuestionAnswerFailed({
    questionId,
    revision,
    userId: session.user.id,
  });

  return getConditionalWriteOutcome({
    questionId,
    updatedCount: updated.count,
    userId: session.user.id,
  });
}
