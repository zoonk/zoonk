import "server-only";
import { type AiGenerationContext } from "@zoonk/ai/ai-generation-event";
import { type LessonQuestionAnswerCompletion } from "@zoonk/ai/tasks/lessons/question";
import { prisma } from "@zoonk/db";
import { replaceEmDashes } from "@zoonk/utils/string";
import { isUuid } from "@zoonk/utils/uuid";
import { claimUsage } from "../entitlements/claim-usage";
import { type UsageDecision } from "../entitlements/contract";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { type MemoryChange } from "../memory/memory-contract";
import { getSession } from "../users/get-session";
import {
  type ClaimLessonQuestionAnswerInput,
  claimAnswerInTransaction,
} from "./_utils/answer-claim";
import { loadLearnerNames } from "./_utils/learner-names";
import { lessonQuestionResourceOmit } from "./_utils/question-resource";
import { getSharedAnswerKey, saveSharedAnswer } from "./_utils/shared-answers";
import { findTutorMemory, markTutorMemoryUsed, rememberTutorExchange } from "./_utils/tutor-memory";
import { type TutorSubject, findThreadSubject } from "./_utils/tutor-subject";

type CompleteLessonQuestionAnswerInput = LessonQuestionAnswerCompletion & {
  questionId: string;
  revision: number;
  /** Only the claim may decide sharing; never derive it from learner input. */
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
  return writeLearnerChange({ userId }, async (tx) => {
    const updated = await tx.lessonQuestion.updateMany({
      data: { status: "failed" },
      where: {
        generationRevision: revision,
        id: questionId,
        status: "running",
        thread: { userId },
      },
    });

    return updated.count > 0 ? updated : unchanged(updated);
  });
}

/** Release the claimed revision before propagating infrastructure failures. */
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

type AnswerClaimOutcome = Awaited<ReturnType<typeof claimAnswerInTransaction>>;

type ClaimedQuestion = Extract<AnswerClaimOutcome, { status: "ready" }>["claim"];

/** Shared answers never read personal memory; allowance must succeed before any memory read. */
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

  if (question.shareAnswer) {
    return { learnerMemory: [], shareAnswer: true, status: "ready" };
  }

  const facts = await findTutorMemory({
    language: subject.language,
    question: question.question,
    userId,
  });

  const learnerMemory = await markTutorMemoryUsed({ facts, userId });

  return { learnerMemory, shareAnswer: false, status: "ready" };
}

function getAnswerAnalytics({
  goalId,
  userId,
}: {
  goalId: string | null;
  userId: string;
}): Pick<AiGenerationContext, "distinctId" | "goalId"> {
  return goalId ? { distinctId: userId, goalId } : { distinctId: userId };
}

/** Requires the owner session; an existing shared answer completes immediately without allowance or memory reads. */
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

  const claimed = await writeLearnerChange<AnswerClaimOutcome>({ userId }, async (transaction) => {
    const result = await claimAnswerInTransaction({ input, now, transaction, userId });

    return result.status === "conflict" || result.status === "notFound"
      ? unchanged(result)
      : result;
  });

  if (claimed.status !== "ready") {
    return claimed;
  }

  const { contextSnapshot, goalId, priorTurns, question, questionId, revision } = claimed.claim;

  const [tutor, learnerNames] = await Promise.all([
    claimTutorAnswer({ question: claimed.claim, subject: access.subject, userId }),
    loadLearnerNames(userId),
  ]);

  if (tutor.status !== "ready") {
    return { decision: tutor, status: "usageRefused" as const };
  }

  const { learnerMemory, shareAnswer } = tutor;

  return {
    claim: {
      analytics: getAnswerAnalytics({ goalId, userId }),
      contextSnapshot,
      learnerMemory,
      /** Only use these names to exclude them from outgoing web searches. */
      learnerNames,
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

/** Only the claimed revision may save; the stored text must match what the learner saw streamed. */
function saveCompletedAnswer({
  input,
  userId,
}: {
  input: CompleteLessonQuestionAnswerInput;
  userId: string;
}) {
  const { questionId, revision, shareAnswer, ...generated } = input;
  const completion = { ...generated, answer: replaceEmDashes(generated.answer) };

  const provenance = {
    generatedAt: new Date(completion.generatedAt),
    model: completion.model,
    promptVersion: completion.promptVersion,
    runId: completion.runId,
  };

  return writeLearnerChange({ userId }, async (transaction) => {
    const updated = await transaction.lessonQuestion.updateMany({
      data: {
        ...provenance,
        answer: completion.answer,
        finishReason: completion.finishReason,
        provider: completion.provider,
        status: "completed",
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

    return updated.count > 0 ? updated.count : unchanged(updated.count);
  });
}

/** Saves only the current owned revision; learn personal memory separately after completion. */
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

/** Shared, unsaved, or another learner's answers never affect memory; failures are logged without failing the answer. */
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

/** Changes only the owned current revision; stale streaming failures have no effect. */
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
