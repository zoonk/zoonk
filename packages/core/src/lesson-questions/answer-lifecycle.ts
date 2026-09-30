import "server-only";
import { type LessonQuestionAnswerCompletion } from "@zoonk/ai/tasks/lessons/question";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { claimUsage } from "../entitlements/claim-usage";
import { type UsageDecision } from "../entitlements/contract";
import { type MemoryChange } from "../memory/memory-contract";
import { getSession } from "../users/get-session";
import {
  type ClaimLessonQuestionAnswerInput,
  claimAnswerInTransaction,
} from "./_utils/answer-claim";
import { lessonQuestionResourceOmit } from "./_utils/question-resource";
import { getSharedAnswerKey, saveSharedAnswer, shouldShareAnswer } from "./_utils/shared-answers";
import { findTutorMemory, markTutorMemoryUsed, rememberTutorExchange } from "./_utils/tutor-memory";
import { type TutorSubject, findThreadSubject } from "./_utils/tutor-subject";

type CompleteLessonQuestionAnswerInput = LessonQuestionAnswerCompletion & {
  questionId: string;
  revision: number;
  /** The claim decided the answer is shared by everyone who asks the same thing on the screen. */
  shareAnswer?: boolean;
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

  return thread ? findThreadSubject({ thread, userId }) : { status: "notFound" as const };
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

/** Releases the claimed revision before propagating an allowance infrastructure failure. */
async function claimTutorUsage({
  question,
  userId,
}: {
  question: { questionId: string; revision: number };
  userId: string;
}): Promise<UsageDecision> {
  try {
    return await claimUsage({ kind: "tutorMessage", targetId: question.questionId });
  } catch (error) {
    await markClaimedLessonQuestionAnswerFailed({
      questionId: question.questionId,
      revision: question.revision,
      userId,
    });

    throw error;
  }
}

type ClaimedQuestion = Extract<
  Awaited<ReturnType<typeof claimAnswerInTransaction>>,
  { status: "ready" }
>["claim"];

/**
 * Whether the answer can be written once for everyone who asks the same thing on the screen. Only
 * a first question about a lesson screen can be.
 */
async function decideSharing({
  question,
  userId,
}: {
  question: ClaimedQuestion;
  userId: string;
}): Promise<boolean> {
  return question.sharing
    ? shouldShareAnswer({
        question: question.question,
        suggested: question.sharing.suggested,
        userId,
      })
    : false;
}

/**
 * A new answer counts against the learner's `tutorMessage` allowance (guests sign up first), even
 * when it's written to share. A personal answer reads what the learner's memory holds about their
 * learning and goals; a shared one is written without it, for anyone who asks the same thing.
 * Nothing is read before the allowance says yes; then memory is read while sharing is decided,
 * and dropped when the answer turns out shared (a suggested question is always shared).
 */
async function claimTutorAnswer({
  question,
  subject,
  userId,
}: {
  question: ClaimedQuestion;
  subject: TutorSubject;
  userId: string;
}): Promise<
  | { learnerMemory: string[]; shareAnswer: boolean; status: "ready" }
  | Exclude<UsageDecision, { status: "allowed" }>
> {
  const usage = await claimTutorUsage({ question, userId });

  if (usage.status !== "allowed") {
    await markClaimedLessonQuestionAnswerFailed({
      questionId: question.questionId,
      revision: question.revision,
      userId,
    });

    return usage;
  }

  const [shareAnswer, facts] = await Promise.all([
    decideSharing({ question, userId }),
    question.sharing?.suggested
      ? []
      : findTutorMemory({ language: subject.language, question: question.question, userId }),
  ]);

  if (shareAnswer) {
    return { learnerMemory: [], shareAnswer, status: "ready" };
  }

  const learnerMemory = await markTutorMemoryUsed({ facts, userId });

  return { learnerMemory, shareAnswer, status: "ready" };
}

/**
 * Atomically claims a pending, failed, or abandoned answer generation for its owner. A first
 * question about a lesson screen that someone already asked there is answered right away with the
 * shared answer (`shared`), without a generation, the allowance or memory.
 */
export async function claimLessonQuestionAnswer(input: ClaimLessonQuestionAnswerInput) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  if (!isUuid(input.questionId)) {
    return { status: "notFound" as const };
  }

  const userId = session.user.id;
  const access = await getQuestionAnswerAccess({ questionId: input.questionId, userId });

  if (access.status !== "ready") {
    return access;
  }

  const now = new Date();

  const claimed = await prisma.$transaction((transaction) =>
    claimAnswerInTransaction({ input, now, transaction, userId }),
  );

  if (claimed.status !== "ready") {
    return claimed;
  }

  const { contextSnapshot, priorTurns, question, questionId, revision } = claimed.claim;

  const tutor = await claimTutorAnswer({
    question: claimed.claim,
    subject: access.subject,
    userId,
  });

  if (tutor.status !== "ready") {
    return { decision: tutor, status: "usageRefused" as const };
  }

  const { learnerMemory, shareAnswer } = tutor;

  return {
    claim: {
      contextSnapshot,
      learnerMemory,
      priorTurns,
      question,
      questionId,
      revision,
      shareAnswer,
    },
    status: "ready" as const,
  };
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

/**
 * Saves the answer and the run that wrote it, only while the generation still owns the claimed
 * revision. A shared answer becomes its screen's answer for everyone who asks the same thing.
 */
function saveCompletedAnswer({
  input,
  userId,
}: {
  input: CompleteLessonQuestionAnswerInput;
  userId: string;
}) {
  const { questionId, revision, shareAnswer, ...completion } = input;

  const provenance = {
    generatedAt: new Date(completion.generatedAt),
    model: completion.model,
    promptVersion: completion.promptVersion,
    runId: completion.runId,
  };

  return prisma.$transaction(async (transaction) => {
    const updated = await transaction.lessonQuestion.updateMany({
      data: {
        ...provenance,
        answer: completion.answer,
        finishReason: completion.finishReason,
        inputTokens: completion.inputTokens ?? null,
        outputTokens: completion.outputTokens ?? null,
        provider: completion.provider,
        status: "completed",
        totalTokens: completion.totalTokens ?? null,
      },
      where: {
        generationRevision: revision,
        id: questionId,
        status: "running",
        thread: { userId },
      },
    });

    const question =
      updated.count > 0 && shareAnswer
        ? await transaction.lessonQuestion.findUniqueOrThrow({ where: { id: questionId } })
        : null;

    const key = question && getSharedAnswerKey({ hasPriorTurns: false, question });

    if (question && key) {
      await saveSharedAnswer({
        answer: completion.answer,
        key,
        provenance,
        question: question.question,
        questionId,
        transaction,
      });
    }

    return updated.count;
  });
}

/**
 * Persists a model completion only when it still owns the current generation revision. What a
 * personal exchange teaches memory is learned afterwards (`rememberLessonQuestionAnswer`), so the
 * answer counts as done as soon as it's saved.
 */
export async function completeLessonQuestionAnswer(input: CompleteLessonQuestionAnswerInput) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  if (!isUuid(input.questionId)) {
    return { status: "notFound" as const };
  }

  const updatedCount = await saveCompletedAnswer({ input, userId: session.user.id });

  return getConditionalWriteOutcome({
    questionId: input.questionId,
    updatedCount,
    userId: session.user.id,
  });
}

/**
 * After a personal answer is saved, the exchange may teach the learner's memory something
 * lasting; the changes come back so the tutor can show "Memory updated" with undo. A shared
 * answer, one not saved yet or another learner's question leaves memory alone. Memory is a help:
 * a failure is logged and nothing changes.
 */
export async function rememberLessonQuestionAnswer({
  questionId,
}: {
  questionId: string;
}): Promise<MemoryChange[]> {
  const session = await getSession();

  if (!session || !isUuid(questionId)) {
    return [];
  }

  return rememberTutorExchange({ questionId, userId: session.user.id });
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
