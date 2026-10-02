import "server-only";
import { type Goal, type LessonQuestionThread, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import { type TutorTarget } from "../contract";
import { type LibraryQuestionLesson, getLessonQuestionAccess } from "./question-access";

/**
 * The thing a thread is about once the learner's access to it is checked, with the language its
 * content and memory are in.
 */
export type TutorSubject =
  | { chapterId: string; kind: "chapter"; language: string }
  | { goal: Goal; kind: "plan"; language: string }
  | { blockId: string | null; kind: "mock"; language: string; mockExamId: string }
  | { kind: "lesson"; language: string; lesson: LibraryQuestionLesson };

/** A thread finds its mock by id: the mock's session block may be gone. */
type SubjectLookup = TutorTarget | { kind: "mock"; mockExamId: string };

type SubjectAccess = { status: "notFound" } | { status: "ready"; subject: TutorSubject };

const NOT_FOUND = { status: "notFound" } as const;

function toAccess(subject: TutorSubject | null): SubjectAccess {
  return subject ? { status: "ready", subject } : NOT_FOUND;
}

async function findLessonSubject({ lessonId, userId }: { lessonId: string; userId: string }) {
  const access = await getLessonQuestionAccess({ lessonId, userId });

  return access.status === "ready"
    ? toAccess({ kind: "lesson", language: access.lesson.language, lesson: access.lesson })
    : NOT_FOUND;
}

/** Public chapters and the learner's own private ones. */
async function findChapterSubject({ chapterId, userId }: { chapterId: string; userId: string }) {
  const chapter = await prisma.chapter.findFirst({
    select: { id: true, language: true },
    where: { ...libraryRowsVisibleTo(userId), id: chapterId },
  });

  return toAccess(
    chapter && { chapterId: chapter.id, kind: "chapter", language: chapter.language },
  );
}

/** A plan belongs to one of the learner's own goals. */
async function findPlanSubject({ goalId, userId }: { goalId: string; userId: string }) {
  const goal = await prisma.goal.findFirst({ where: { id: goalId, userId } });
  return toAccess(goal && { goal, kind: "plan", language: goal.language });
}

/**
 * Only the learner's own finished mocks: the tutor never helps with an exam that's still running.
 */
async function findMockSubject({
  userId,
  where,
}: {
  userId: string;
  where: { blockId: string } | { id: string };
}) {
  const mock = await prisma.mockExam.findFirst({
    include: {
      examBlueprint: { select: { language: true } },
      goal: { select: { language: true } },
    },
    where: { ...where, status: "finished", userId },
  });

  const language = mock?.goal?.language ?? mock?.examBlueprint?.language;

  return toAccess(
    mock && language
      ? { blockId: mock.blockId, kind: "mock", language, mockExamId: mock.id }
      : null,
  );
}

function getLookupId(lookup: SubjectLookup): string {
  switch (lookup.kind) {
    case "chapter":
      return lookup.chapterId;
    case "lesson":
      return lookup.lessonId;
    case "mock":
      return "blockId" in lookup ? lookup.blockId : lookup.mockExamId;
    case "plan":
      return lookup.goalId;
    default:
      return lookup satisfies never;
  }
}

function findSubject({ lookup, userId }: { lookup: SubjectLookup; userId: string }) {
  switch (lookup.kind) {
    case "chapter":
      return findChapterSubject({ chapterId: lookup.chapterId, userId });
    case "lesson":
      return findLessonSubject({ lessonId: lookup.lessonId, userId });
    case "mock":
      return findMockSubject({
        userId,
        where: "blockId" in lookup ? { blockId: lookup.blockId } : { id: lookup.mockExamId },
      });
    case "plan":
      return findPlanSubject({ goalId: lookup.goalId, userId });
    default:
      return lookup satisfies never;
  }
}

/**
 * Checks the learner may ask about a thing, again for every question operation: lessons and
 * chapters that are public or their own, their own goals' plans and their own finished mocks.
 */
export async function findTutorSubject({
  target,
  userId,
}: {
  target: SubjectLookup;
  userId: string;
}): Promise<SubjectAccess> {
  if (!isUuid(getLookupId(target))) {
    return NOT_FOUND;
  }

  return findSubject({ lookup: target, userId });
}

/**
 * What a stored thread is about; null when its content is gone. Nothing answers a thread about a
 * course any more: the plan's "Ask" answers about the course it's built from.
 */
function getThreadLookup(
  thread: Pick<
    LessonQuestionThread,
    "chapterId" | "goalId" | "kind" | "libraryLessonId" | "mockExamId"
  >,
): SubjectLookup | null {
  const lookups = {
    chapter: thread.chapterId && { chapterId: thread.chapterId, kind: "chapter" as const },
    lesson: thread.libraryLessonId && { kind: "lesson" as const, lessonId: thread.libraryLessonId },
    mock: thread.mockExamId && { kind: "mock" as const, mockExamId: thread.mockExamId },
    plan: thread.goalId && { goalId: thread.goalId, kind: "plan" as const },
  };

  return lookups[thread.kind] || null;
}

/** Re-checks access to what a stored thread is about. */
export function findThreadSubject({
  thread,
  userId,
}: {
  thread: Parameters<typeof getThreadLookup>[0];
  userId: string;
}): Promise<SubjectAccess> {
  const lookup = getThreadLookup(thread);
  return lookup ? findTutorSubject({ target: lookup, userId }) : Promise.resolve(NOT_FOUND);
}

/** The thread's column for its subject: one thread per learner and thing. */
export function getSubjectThreadColumn(subject: TutorSubject) {
  switch (subject.kind) {
    case "chapter":
      return { chapterId: subject.chapterId };
    case "lesson":
      return { libraryLessonId: subject.lesson.id };
    case "mock":
      return { mockExamId: subject.mockExamId };
    case "plan":
      return { goalId: subject.goal.id };
    default:
      return subject satisfies never;
  }
}
