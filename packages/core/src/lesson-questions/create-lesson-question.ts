import "server-only";
import { type LessonQuestionContextSnapshot } from "@zoonk/ai/tasks/lessons/question";
import { type LessonQuestion, prisma } from "@zoonk/db";
import { getSession } from "../users/get-session";
import { buildLessonQuestionContextSnapshot } from "./_utils/context-snapshot";
import { toDatabaseLessonQuestionContextSnapshot } from "./_utils/context-snapshot-schema";
import { getLessonQuestionAccess } from "./_utils/question-access";
import { toLessonQuestionResource } from "./_utils/question-resource";
import { getLessonQuestionRequestFingerprint } from "./_utils/request-fingerprint";
import { lockLessonQuestionThread } from "./_utils/thread-lock";
import { type CreateLessonQuestionInput } from "./contract";

function getCreateLessonQuestionOutcome({
  question,
  requestFingerprint,
}: {
  question: LessonQuestion;
  requestFingerprint: string;
}) {
  if (question.requestFingerprint !== requestFingerprint) {
    return { status: "conflict" as const };
  }

  return { question: toLessonQuestionResource(question), status: "created" as const };
}

function findExistingLessonQuestion({
  lessonId,
  requestId,
  userId,
}: {
  lessonId: string;
  requestId: string;
  userId: string;
}) {
  return prisma.lessonQuestion.findFirst({ where: { requestId, thread: { lessonId, userId } } });
}

async function persistLessonQuestion({
  contextSnapshot,
  input,
  lessonId,
  requestFingerprint,
  stepId,
  userId,
}: {
  contextSnapshot: LessonQuestionContextSnapshot;
  input: CreateLessonQuestionInput;
  lessonId: string;
  requestFingerprint: string;
  stepId: string | null;
  userId: string;
}) {
  return prisma.$transaction(async (transaction) => {
    await transaction.lessonQuestionThread.createMany({
      data: [{ lessonId, userId }],
      skipDuplicates: true,
    });

    const thread = await transaction.lessonQuestionThread.findUniqueOrThrow({
      where: { userLessonQuestionThread: { lessonId, userId } },
    });

    await lockLessonQuestionThread({ threadId: thread.id, transaction });

    const existingQuestion = await transaction.lessonQuestion.findUnique({
      where: { threadLessonQuestionRequest: { requestId: input.requestId, threadId: thread.id } },
    });

    if (existingQuestion) {
      return getCreateLessonQuestionOutcome({ question: existingQuestion, requestFingerprint });
    }

    const unfinishedQuestion = await transaction.lessonQuestion.findFirst({
      where: { status: { not: "completed" }, threadId: thread.id },
    });

    if (unfinishedQuestion) {
      return { status: "conflict" as const };
    }

    const [question] = await Promise.all([
      transaction.lessonQuestion.create({
        data: {
          contextKind: input.context.kind,
          contextSnapshot: toDatabaseLessonQuestionContextSnapshot(contextSnapshot),
          question: input.question,
          requestFingerprint,
          requestId: input.requestId,
          stepId,
          threadId: thread.id,
        },
      }),
      transaction.lessonQuestionThread.update({
        data: { updatedAt: new Date() },
        where: { id: thread.id },
      }),
    ]);

    return getCreateLessonQuestionOutcome({ question, requestFingerprint });
  });
}

/**
 * Creates one durable learner turn only after live lesson access and every client-selected
 * step ID have been resolved to authoritative curriculum content owned by the server.
 */
export async function createLessonQuestion({
  input,
  lessonId,
}: {
  input: CreateLessonQuestionInput;
  lessonId: string;
}) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  const access = await getLessonQuestionAccess({ lessonId, userId: session.user.id });

  if (access.status !== "ready") {
    return access;
  }

  const requestFingerprint = getLessonQuestionRequestFingerprint(input);

  const existingQuestion = await findExistingLessonQuestion({
    lessonId,
    requestId: input.requestId,
    userId: session.user.id,
  });

  if (existingQuestion) {
    return getCreateLessonQuestionOutcome({ question: existingQuestion, requestFingerprint });
  }

  const context = await buildLessonQuestionContextSnapshot({
    context: input.context,
    lesson: access.lesson,
  });

  if (context.status !== "ready") {
    return context;
  }

  return persistLessonQuestion({
    contextSnapshot: context.contextSnapshot,
    input,
    lessonId,
    requestFingerprint,
    stepId: context.stepId,
    userId: session.user.id,
  });
}
