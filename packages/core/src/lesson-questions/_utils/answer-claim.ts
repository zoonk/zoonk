import { type LessonQuestionPriorTurn } from "@zoonk/ai/tasks/lessons/question";
import "server-only";
import { type LessonQuestion, type TransactionClient, type TutorSharedAnswer } from "@zoonk/db";
import { aboutCheckedAnswerWhere, findAboutCheckedAnswer } from "./about-checked-answer";
import { parseLessonQuestionContextSnapshot } from "./context-snapshot-schema";
import { getQuestionMistakeId, mistakeQuestionWhere } from "./mistake-scope";
import { lessonQuestionResourceOmit } from "./question-resource";
import { getSharedAnswerKey } from "./shared-answers";
import { lockLessonQuestionThread } from "./thread-lock";
import { getTutorModel } from "./tutor-model";
import { getTutorNeeds } from "./tutor-needs";

const MAX_PRIOR_TURNS = 12;
const STALE_GENERATION_MILLISECONDS = 2 * 60 * 1000;

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

function sameStepWhere(question: { contextSnapshot: unknown; libraryStepId: string | null }) {
  return {
    ...mistakeQuestionWhere(getQuestionMistakeId(question.contextSnapshot)),
    libraryStepId: question.libraryStepId,
  };
}

/** Exclude earlier checked-answer turns while giving hints; restore them only after the question is checked again. */
async function getPriorTurns({
  question,
  transaction,
}: {
  question: {
    contextSnapshot: unknown;
    createdAt: Date;
    id: string;
    libraryStepId: string | null;
    threadId: string;
  };
  transaction: TransactionClient;
}) {
  const { createdAt } = question;

  const aboutAnswer = await findAboutCheckedAnswer({
    client: transaction,
    questionIds: [question.id],
  });

  const questions = await transaction.lessonQuestion.findMany({
    omit: lessonQuestionResourceOmit,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MAX_PRIOR_TURNS,
    where: {
      OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: question.id } }],
      answer: { not: null },
      status: "completed",
      ...sameStepWhere(question),
      ...(aboutAnswer.has(question.id) ? {} : { NOT: aboutCheckedAnswerWhere }),
      threadId: question.threadId,
    },
  });

  return toPriorTurns(questions);
}

async function hasBlockingQuestion({
  question,
  transaction,
}: {
  question: {
    contextSnapshot: unknown;
    createdAt: Date;
    id: string;
    libraryStepId: string | null;
    threadId: string;
  };
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

type AnsweredQuestion = Pick<
  LessonQuestion,
  | "contextKind"
  | "contextSnapshot"
  | "createdAt"
  | "id"
  | "libraryStepId"
  | "suggestion"
  | "threadId"
>;

/** Shared answers go only to a first-turn screen suggestion from a learner whose answer isn't personal. */
async function readAnswerInputs({
  question,
  transaction,
  userId,
}: {
  question: AnsweredQuestion;
  transaction: TransactionClient;
  userId: string;
}) {
  const priorTurns = await getPriorTurns({ question, transaction });
  const contextSnapshot = parseLessonQuestionContextSnapshot(question.contextSnapshot);

  const tutor = await getTutorNeeds({
    client: transaction,
    task: contextSnapshot.scope.kind === "plan" ? "goal" : "lesson",
    userId,
  });

  const sharedKey = tutor.personal
    ? null
    : getSharedAnswerKey({ hasPriorTurns: priorTurns.length > 0, question });

  const shared = sharedKey
    ? await transaction.tutorSharedAnswer.findUnique({ where: { stepSuggestion: sharedKey } })
    : null;

  return { contextSnapshot, priorTurns, shared, sharedKey, tutor };
}

function getSharedAnswerData(shared: TutorSharedAnswer) {
  return {
    answer: shared.answer,
    finishReason: null,
    generatedAt: shared.generatedAt,
    generationRevision: { increment: 1 },
    model: shared.model,
    promptVersion: shared.promptVersion,
    provider: null,
    requestedModel: null,
    runId: shared.runId,
    sharedAnswerId: shared.id,
    status: "completed" as const,
  };
}

/**
 * Completes a question just asked with the shared answer the answer claim would serve it, in the
 * write that saves it, so it uses no allowance and nothing the learner changes later can fail it.
 * Null when it has none.
 */
export async function completeFromSharedAnswer({
  question,
  transaction,
  userId,
}: {
  question: AnsweredQuestion;
  transaction: TransactionClient;
  userId: string;
}) {
  if (!getSharedAnswerKey({ hasPriorTurns: false, question })) {
    return null;
  }

  const { shared } = await readAnswerInputs({ question, transaction, userId });

  return shared
    ? transaction.lessonQuestion.update({
        data: getSharedAnswerData(shared),
        omit: lessonQuestionResourceOmit,
        where: { id: question.id },
      })
    : null;
}

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

/** A question charged when it was asked gets its message back, since no answer is written for it. */
async function completeWithSharedAnswer({
  question,
  shared,
  transaction,
  userId,
  where,
}: {
  question: { id: string };
  shared: TutorSharedAnswer;
  transaction: TransactionClient;
  userId: string;
  where: ReturnType<typeof getClaimWhere>;
}) {
  const completed = await transaction.lessonQuestion.updateMany({
    data: getSharedAnswerData(shared),
    where,
  });

  if (completed.count === 0) {
    return { status: "conflict" as const };
  }

  await transaction.usageRecord.deleteMany({
    where: { kind: "tutorMessage", targetId: question.id, userId },
  });

  return { answer: shared.answer, questionId: question.id, status: "shared" as const };
}

export async function claimAnswerInTransaction({
  input,
  now,
  transaction,
  userId,
}: {
  input: { questionId: string };
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

  const { contextSnapshot, priorTurns, shared, sharedKey, tutor } = await readAnswerInputs({
    question,
    transaction,
    userId,
  });

  const { addressForm, needs: learnerNeeds } = tutor;
  const claimWhere = getClaimWhere({ now, question, userId });

  if (shared) {
    return completeWithSharedAnswer({ question, shared, transaction, userId, where: claimWhere });
  }

  const shareAnswer = sharedKey !== null;

  const claimed = await transaction.lessonQuestion.updateMany({
    data: {
      answer: null,
      finishReason: null,
      generatedAt: null,
      generationRevision: { increment: 1 },
      model: null,
      promptVersion: null,
      provider: null,
      requestedModel: getTutorModel({ contextSnapshot, shareAnswer }),
      runId: null,
      status: "running",
    },
    where: claimWhere,
  });

  if (claimed.count === 0) {
    return { status: "conflict" as const };
  }

  return {
    claim: {
      addressForm: shareAnswer ? undefined : (addressForm ?? undefined),
      contextSnapshot,
      goalId: question.goalId,
      learnerNeeds,
      priorTurns,
      question: question.question,
      questionId: question.id,
      revision: question.generationRevision + 1,
      shareAnswer,
    },
    status: "ready" as const,
  };
}
