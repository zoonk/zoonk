import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../users/get-session";
import {
  lessonQuestionResourceOmit,
  lessonQuestionResourceQuery,
  toLessonQuestionThreadResource,
} from "./_utils/question-resource";
import { findTutorSubject, getSubjectThreadColumn } from "./_utils/tutor-subject";
import {
  type GetLessonQuestionThreadInput,
  MAX_LESSON_QUESTION_THREAD_TURNS,
  type TutorTarget,
} from "./contract";

type ThreadWhere = ReturnType<typeof getSubjectThreadColumn> & { userId: string };

type QuestionScope = {
  contextKind: GetLessonQuestionThreadInput["contextKind"];
  stepId: string | undefined;
  thread: ThreadWhere;
};

function getScopeWhere({ contextKind, stepId, thread }: QuestionScope) {
  return { contextKind, libraryStepId: stepId, thread };
}

async function getCursorQuestion({ cursor, ...scope }: QuestionScope & { cursor: string }) {
  return prisma.lessonQuestion.findFirst({
    omit: lessonQuestionResourceOmit,
    where: { id: cursor, ...getScopeWhere(scope) },
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
  ...scope
}: QuestionScope & { cursor: string | undefined }) {
  const cursorQuestion = cursor ? await getCursorQuestion({ cursor, ...scope }) : null;

  if (cursor && !cursorQuestion) {
    return { status: "invalidCursor" as const };
  }

  const questions = await prisma.lessonQuestion.findMany({
    ...lessonQuestionResourceQuery,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MAX_LESSON_QUESTION_THREAD_TURNS + 1,
    where: { ...getScopeWhere(scope), ...getOlderQuestionsWhere(cursorQuestion) },
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

/**
 * The learner's thread about a lesson, chapter, plan or finished mock, newest page first.
 * Filters before pagination so other steps cannot displace the active step's history. Private
 * cached, so the buddy's tab prefetches with its conversation; the conversation reads it again
 * through the API once on screen, so nothing asked meanwhile is missed.
 */
export async function getLessonQuestionThread({
  contextKind,
  cursor,
  stepId,
  target,
}: GetLessonQuestionThreadInput & { target: TutorTarget }) {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  const access = await findTutorSubject({ target, userId: session.user.id });

  if (access.status !== "ready") {
    return access;
  }

  if (cursor && !isUuid(cursor)) {
    return { status: "invalidCursor" as const };
  }

  const thread = { ...getSubjectThreadColumn(access.subject), userId: session.user.id };

  const [found, page] = await Promise.all([
    prisma.lessonQuestionThread.findFirst({ where: thread }),
    getQuestionPage({ contextKind, cursor, stepId, thread }),
  ]);

  if (page.status !== "ready") {
    return page;
  }

  if (!found) {
    return { status: "ready" as const, thread: null };
  }

  return {
    status: "ready" as const,
    thread: toLessonQuestionThreadResource({
      hasMore: page.hasMore,
      nextCursor: page.nextCursor,
      thread: { ...found, questions: page.questions },
    }),
  };
}
