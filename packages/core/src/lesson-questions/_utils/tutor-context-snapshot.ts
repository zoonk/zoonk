import "server-only";
import {
  type PlanScopeContext,
  type TutorScreenContext,
} from "@zoonk/ai/tasks/lessons/question-context";
import { type LessonQuestionContextInput, type LessonScopeContextInput } from "../contract";
import { buildChapterContextSnapshot } from "./chapter-context-snapshot";
import { buildLibraryQuestionContextSnapshot } from "./library-context-snapshot";
import { buildMockContextSnapshot } from "./mock-context-snapshot";
import { buildPlanContextSnapshot } from "./plan-context-snapshot";
import { type TutorSubject } from "./tutor-subject";
import { findSubjectGoal } from "./tutored-goal";

const INVALID_CONTEXT = { status: "invalidContext" } as const;

type ScreenSubject = Exclude<TutorSubject, { kind: "plan" }>;

type ScreenSnapshot =
  | typeof INVALID_CONTEXT
  | {
      contextSnapshot: TutorScreenContext;
      status: "ready";
      stepId: string | null;
      stepNumber: number | null;
    };

function isLessonContext(context: LessonQuestionContextInput): context is LessonScopeContextInput {
  return context.kind === "lesson" || context.kind === "step" || context.kind === "answer";
}

function toScreenSnapshot(contextSnapshot: TutorScreenContext | null): ScreenSnapshot {
  return contextSnapshot
    ? { contextSnapshot, status: "ready", stepId: null, stepNumber: null }
    : INVALID_CONTEXT;
}

/**
 * What the screen shows: a lesson's screens and answers from the step ids the client sent, or the
 * chapter or mock as a whole. The context must match the thing the thread is about.
 */
async function buildScreenSnapshot({
  context,
  subject,
  userId,
}: {
  context: LessonQuestionContextInput;
  subject: ScreenSubject;
  userId: string;
}): Promise<ScreenSnapshot> {
  if (subject.kind === "lesson") {
    return isLessonContext(context)
      ? buildLibraryQuestionContextSnapshot({ context, lesson: subject.lesson, userId })
      : INVALID_CONTEXT;
  }

  if (context.kind !== subject.kind) {
    return INVALID_CONTEXT;
  }

  switch (subject.kind) {
    case "chapter":
      return toScreenSnapshot(
        await buildChapterContextSnapshot({ chapterId: subject.chapterId, userId }),
      );
    case "mock":
      return toScreenSnapshot(
        await buildMockContextSnapshot({
          blockId: subject.blockId ?? subject.mockExamId,
          language: subject.language,
        }),
      );
    default:
      return subject satisfies never;
  }
}

/** The plan of the goal a screen belongs to, as the buddy reads it; null without one. */
async function buildScreenGoalSnapshot({
  subject,
  userId,
}: {
  subject: ScreenSubject;
  userId: string;
}): Promise<PlanScopeContext | null> {
  const goal = await findSubjectGoal({ subject, userId });
  return goal ? buildPlanContextSnapshot(goal) : null;
}

/**
 * What the tutor sees for a new question, built on the server. A question about the plan, or
 * from a chapter, a lesson or a finished mock inside one of the learner's goals, goes to the
 * buddy with the goal's plan, plus the screen it came from: every place the buddy is asked can
 * read the plan, propose a change to it and offer the app's features. A learner without a goal
 * asks about the screen alone.
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
  if (subject.kind === "plan") {
    const contextSnapshot =
      context.kind === "plan" ? await buildPlanContextSnapshot(subject.goal) : null;

    return contextSnapshot
      ? { contextSnapshot, status: "ready" as const, stepId: null, stepNumber: null }
      : INVALID_CONTEXT;
  }

  const [screen, plan] = await Promise.all([
    buildScreenSnapshot({ context, subject, userId }),
    buildScreenGoalSnapshot({ subject, userId }),
  ]);

  if (screen.status !== "ready" || !plan) {
    return screen;
  }

  return { ...screen, contextSnapshot: { ...plan, screen: screen.contextSnapshot } };
}
