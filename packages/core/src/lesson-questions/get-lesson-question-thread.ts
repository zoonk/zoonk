import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../users/get-session";
import { getLessonQuestionAccess } from "./_utils/question-access";
import {
  lessonQuestionResourceOmit,
  toLessonQuestionThreadResource,
} from "./_utils/question-resource";
import { type GetLessonQuestionThreadInput, MAX_LESSON_QUESTION_THREAD_TURNS } from "./contract";

async function getCursorQuestion({
  cursor,
  lessonId,
  userId,
}: {
  cursor: string;
  lessonId: string;
  userId: string;
}) {
  return prisma.lessonQuestion.findFirst({
    omit: lessonQuestionResourceOmit,
    where: { id: cursor, thread: { lessonId, userId } },
  });
}

function getOlderQuestionsWhere(cursorQuestion: { createdAt: Date; id: string } | null) {
  if (!cursorQuestion) {
    return {};
  }

  return {
    OR: [
      { createdAt: { lt: cursorQuestion.createdAt } },
      { createdAt: cursorQuestion.createdAt, id: { lt: cursorQuestion.id } },
    ],
  };
}

async function getQuestionPage({
  cursor,
  lessonId,
  userId,
}: {
  cursor: string | undefined;
  lessonId: string;
  userId: string;
}) {
  const cursorQuestion = cursor ? await getCursorQuestion({ cursor, lessonId, userId }) : null;

  if (cursor && !cursorQuestion) {
    return { status: "invalidCursor" as const };
  }

  const questions = await prisma.lessonQuestion.findMany({
    omit: lessonQuestionResourceOmit,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MAX_LESSON_QUESTION_THREAD_TURNS + 1,
    where: { ...getOlderQuestionsWhere(cursorQuestion), thread: { lessonId, userId } },
  });

  const hasMore = questions.length > MAX_LESSON_QUESTION_THREAD_TURNS;
  const page = questions.slice(0, MAX_LESSON_QUESTION_THREAD_TURNS);

  return {
    hasMore,
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    questions: page.toReversed(),
    status: "ready" as const,
  };
}

/** Returns the current learner's lesson-scoped conversation without exposing stored AI metadata. */
export async function getLessonQuestionThread({
  cursor,
  lessonId,
}: GetLessonQuestionThreadInput & { lessonId: string }) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  const access = await getLessonQuestionAccess({ lessonId, userId: session.user.id });

  if (access.status !== "ready") {
    return access;
  }

  if (cursor && !isUuid(cursor)) {
    return { status: "invalidCursor" as const };
  }

  const [thread, page] = await Promise.all([
    prisma.lessonQuestionThread.findUnique({
      where: { userLessonQuestionThread: { lessonId, userId: session.user.id } },
    }),
    getQuestionPage({ cursor, lessonId, userId: session.user.id }),
  ]);

  if (page.status !== "ready") {
    return page;
  }

  if (!thread) {
    return { status: "ready" as const, thread: null };
  }

  return {
    status: "ready" as const,
    thread: toLessonQuestionThreadResource({
      hasMore: page.hasMore,
      nextCursor: page.nextCursor,
      thread: { ...thread, questions: page.questions },
    }),
  };
}
