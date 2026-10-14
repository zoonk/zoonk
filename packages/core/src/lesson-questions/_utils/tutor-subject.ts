import "server-only";
import { type Goal, type LessonQuestionThread, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { hasStoredTimeRunOutAway } from "../../exams/mocks/_utils/owned-mock";
import { mockConditionsSchema } from "../../exams/mocks/mock-contract";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import { getSyllabusView } from "../../view-models/syllabus/get-syllabus-view";
import { type SyllabusSubject } from "../../view-models/syllabus/syllabus-contract";
import { type TutorTarget } from "../contract";
import { type LibraryQuestionLesson, getLessonQuestionAccess } from "./question-access";

/**
 * The thing a thread is about once the learner's access to it is checked, with the language its
 * content and memory are in.
 */
export type TutorSubject =
  | { chapterId: string; kind: "chapter"; language: string }
  | { goal: Goal; kind: "plan"; language: string }
  | { item: { id: string; language: string }; kind: "item"; language: string }
  | {
      goal: Goal;
      kind: "subject";
      language: string;
      /** The subject as the goal's syllabus shows it now. */
      syllabusSubject: SyllabusSubject;
    }
  | {
      blockId: string | null;
      /** The goal the mock was taken for, whose plan the buddy reads with it. */
      goalId: string | null;
      kind: "mock";
      language: string;
      mockExamId: string;
    }
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

/** A subject of one of the learner's own goals, by its key in the goal's syllabus. */
async function findSyllabusSubject({
  goalId,
  subjectKey,
  userId,
}: {
  goalId: string;
  subjectKey: string;
  userId: string;
}) {
  const [goal, syllabus] = await Promise.all([
    prisma.goal.findFirst({ where: { id: goalId, userId } }),
    getSyllabusView({ goalId }),
  ]);

  const syllabusSubject =
    syllabus.status === "ready"
      ? syllabus.syllabus.subjects.find((subject) => subject.key === subjectKey)
      : undefined;

  return toAccess(
    goal && syllabusSubject
      ? { goal, kind: "subject", language: goal.language, syllabusSubject }
      : null,
  );
}

/**
 * Whether the question is on a mock the learner is still sitting, not one whose time ran out while
 * they were away.
 */
async function isOnRunningMock({ itemId, userId }: { itemId: string; userId: string }) {
  const mocks = await prisma.mockExam.findMany({
    select: {
      answers: { select: { answer: true } },
      conditions: true,
      sectionIndex: true,
      sectionStartedAt: true,
      status: true,
    },
    where: { status: "active", userId },
  });

  const now = Date.now();

  return mocks.some(
    (mock) =>
      !hasStoredTimeRunOutAway({ mock, now }) &&
      mockConditionsSchema
        .safeParse(mock.conditions)
        .data?.sections.some((section) => section.itemIds.includes(itemId)),
  );
}

/**
 * A question of the item bank, as sessions and mistakes practice ask it, unless it's on a mock the
 * learner is still sitting: the tutor never helps with an exam that's still running.
 */
async function findItemSubject({ itemId, userId }: { itemId: string; userId: string }) {
  const [item, onRunningMock] = await Promise.all([
    prisma.item.findFirst({
      select: { id: true, language: true },
      where: { id: itemId, skill: libraryRowsVisibleTo(userId) },
    }),
    isOnRunningMock({ itemId, userId }),
  ]);

  return toAccess(item && !onRunningMock ? { item, kind: "item", language: item.language } : null);
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
  // A mock taken any time opens by its own id, where a scheduled one opens by its block's.
  const opened = "blockId" in where ? { OR: [where, { blockId: null, id: where.blockId }] } : where;

  const mock = await prisma.mockExam.findFirst({
    include: {
      examBlueprint: { select: { language: true } },
      goal: { select: { language: true } },
    },
    where: { ...opened, status: "finished", userId },
  });

  const language = mock?.goal?.language ?? mock?.examBlueprint?.language;

  return toAccess(
    mock && language
      ? { blockId: mock.blockId, goalId: mock.goalId, kind: "mock", language, mockExamId: mock.id }
      : null,
  );
}

function getLookupId(lookup: SubjectLookup): string {
  switch (lookup.kind) {
    case "chapter":
      return lookup.chapterId;
    case "item":
      return lookup.itemId;
    case "lesson":
      return lookup.lessonId;
    case "mock":
      return "blockId" in lookup ? lookup.blockId : lookup.mockExamId;
    case "plan":
    case "subject":
      return lookup.goalId;
    default:
      return lookup satisfies never;
  }
}

function findSubject({ lookup, userId }: { lookup: SubjectLookup; userId: string }) {
  switch (lookup.kind) {
    case "chapter":
      return findChapterSubject({ chapterId: lookup.chapterId, userId });
    case "item":
      return findItemSubject({ itemId: lookup.itemId, userId });
    case "lesson":
      return findLessonSubject({ lessonId: lookup.lessonId, userId });
    case "mock":
      return findMockSubject({
        userId,
        where: "blockId" in lookup ? { blockId: lookup.blockId } : { id: lookup.mockExamId },
      });
    case "plan":
      return findPlanSubject({ goalId: lookup.goalId, userId });
    case "subject":
      return findSyllabusSubject({ goalId: lookup.goalId, subjectKey: lookup.subjectKey, userId });
    default:
      return lookup satisfies never;
  }
}

/**
 * Checks the learner may ask about a thing, again for every question operation: lessons and
 * chapters that are public or their own, their own goals' plans and subjects, item-bank questions
 * not on a mock they're sitting, and their own finished mocks.
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
    | "chapterId"
    | "goalId"
    | "itemId"
    | "kind"
    | "libraryLessonId"
    | "mockExamId"
    | "subjectGoalId"
    | "subjectKey"
  >,
): SubjectLookup | null {
  const lookups = {
    chapter: thread.chapterId && { chapterId: thread.chapterId, kind: "chapter" as const },
    item: thread.itemId && { itemId: thread.itemId, kind: "item" as const },
    lesson: thread.libraryLessonId && { kind: "lesson" as const, lessonId: thread.libraryLessonId },
    mock: thread.mockExamId && { kind: "mock" as const, mockExamId: thread.mockExamId },
    plan: thread.goalId && { goalId: thread.goalId, kind: "plan" as const },
    subject: thread.subjectGoalId &&
      thread.subjectKey && {
        goalId: thread.subjectGoalId,
        kind: "subject" as const,
        subjectKey: thread.subjectKey,
      },
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
    case "item":
      return { itemId: subject.item.id };
    case "lesson":
      return { libraryLessonId: subject.lesson.id };
    case "mock":
      return { mockExamId: subject.mockExamId };
    case "plan":
      return { goalId: subject.goal.id };
    case "subject":
      return { subjectGoalId: subject.goal.id, subjectKey: subject.syllabusSubject.key };
    default:
      return subject satisfies never;
  }
}
