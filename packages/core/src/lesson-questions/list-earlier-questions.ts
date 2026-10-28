import "server-only";
import { prisma } from "@zoonk/db";
import { getString, isJsonObject } from "@zoonk/utils/json";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../users/get-session";

/** Titles come from the saved snapshot when the original course or lesson is gone. */
export type EarlierQuestion = {
  answer: string | null;
  askedAt: string;
  courseTitle: string | null;
  id: string;
  lessonTitle: string | null;
  question: string;
};

export type EarlierQuestionsResult =
  | { nextCursor: string | null; questions: EarlierQuestion[]; status: "ready" }
  | { status: "invalidCursor" }
  | { status: "unauthorized" };

const EARLIER_QUESTIONS_PAGE_SIZE = 50;

function earlierThreadWhere(userId: string) {
  return {
    chapterId: null,
    goalId: null,
    itemId: null,
    kind: "lesson" as const,
    libraryLessonId: null,
    mockExamId: null,
    subjectGoalId: null,
    userId,
  };
}

function readSnapshotTitle(snapshot: unknown, key: "course" | "lesson"): string | null {
  const part = isJsonObject(snapshot) ? snapshot[key] : null;
  return getString(part, "title");
}

export async function hasEarlierQuestions(): Promise<boolean> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return false;
  }

  const question = await prisma.lessonQuestion.findFirst({
    select: { id: true },
    where: { thread: earlierThreadWhere(session.user.id) },
  });

  return question !== null;
}

async function getOlderWhere({ cursor, userId }: { cursor?: string; userId: string }) {
  if (!cursor) {
    return {};
  }

  const from = isUuid(cursor)
    ? await prisma.lessonQuestion.findFirst({
        select: { createdAt: true, id: true },
        where: { id: cursor, thread: earlierThreadWhere(userId) },
      })
    : null;

  if (!from) {
    return null;
  }

  return {
    OR: [{ createdAt: { lt: from.createdAt } }, { createdAt: from.createdAt, id: { lt: from.id } }],
  };
}

/** Read-only history, newest first; cursor is the previous page's last question id. */
export async function listEarlierQuestions({
  cursor,
}: { cursor?: string } = {}): Promise<EarlierQuestionsResult> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const older = await getOlderWhere({ cursor, userId });

  if (!older) {
    return { status: "invalidCursor" };
  }

  const rows = await prisma.lessonQuestion.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { answer: true, contextSnapshot: true, createdAt: true, id: true, question: true },
    take: EARLIER_QUESTIONS_PAGE_SIZE + 1,
    where: { thread: earlierThreadWhere(userId), ...older },
  });

  const page = rows.slice(0, EARLIER_QUESTIONS_PAGE_SIZE);

  return {
    nextCursor: rows.length > EARLIER_QUESTIONS_PAGE_SIZE ? (page.at(-1)?.id ?? null) : null,
    questions: page.map((row) => ({
      answer: row.answer,
      askedAt: row.createdAt.toISOString(),
      courseTitle: readSnapshotTitle(row.contextSnapshot, "course"),
      id: row.id,
      lessonTitle: readSnapshotTitle(row.contextSnapshot, "lesson"),
      question: row.question,
    })),
    status: "ready",
  };
}
