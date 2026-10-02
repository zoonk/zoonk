import "server-only";
import { type LessonQuestionContextSnapshot } from "@zoonk/ai/tasks/lessons/question-context";
import { type LessonQuestionContextInput, type LessonScopeContextInput } from "../contract";
import { buildChapterContextSnapshot } from "./chapter-context-snapshot";
import { buildLibraryQuestionContextSnapshot } from "./library-context-snapshot";
import { buildMockContextSnapshot } from "./mock-context-snapshot";
import { buildPlanContextSnapshot } from "./plan-context-snapshot";
import { type TutorSubject } from "./tutor-subject";

const INVALID_CONTEXT = { status: "invalidContext" } as const;

type ScreenSubject = Exclude<TutorSubject, { kind: "lesson" }>;

function isLessonContext(context: LessonQuestionContextInput): context is LessonScopeContextInput {
  return context.kind === "lesson" || context.kind === "step" || context.kind === "answer";
}

function buildScreenSnapshot({
  subject,
  userId,
}: {
  subject: ScreenSubject;
  userId: string;
}): Promise<LessonQuestionContextSnapshot | null> {
  switch (subject.kind) {
    case "chapter":
      return buildChapterContextSnapshot({ chapterId: subject.chapterId, userId });
    case "mock":
      return subject.blockId
        ? buildMockContextSnapshot({ blockId: subject.blockId, language: subject.language })
        : Promise.resolve(null);
    case "plan":
      return buildPlanContextSnapshot(subject.goal);
    default:
      return subject satisfies never;
  }
}

/**
 * What the tutor sees for a new question, built on the server: a lesson's screens and answers
 * from the step ids the client sent, or the chapter, plan or mock asked about as a whole.
 * The context must match the thing the thread is about.
 */
export async function buildTutorContextSnapshot({
  context,
  subject,
  userId,
}: {
  context: LessonQuestionContextInput;
  subject: TutorSubject;
  userId: string;
}) {
  if (subject.kind === "lesson") {
    return isLessonContext(context)
      ? buildLibraryQuestionContextSnapshot({ context, lesson: subject.lesson, userId })
      : INVALID_CONTEXT;
  }

  if (context.kind !== subject.kind) {
    return INVALID_CONTEXT;
  }

  const contextSnapshot = await buildScreenSnapshot({ subject, userId });

  return contextSnapshot
    ? { contextSnapshot, status: "ready" as const, stepId: null, stepNumber: null }
    : INVALID_CONTEXT;
}
