import "server-only";
import {
  type ItemScopeContext,
  type PlanScopeContext,
  type SubjectScopeContext,
  type TutorScreenContext,
} from "@zoonk/ai/tasks/lessons/question-context";
import { type LessonQuestionContextInput, type LessonScopeContextInput } from "../contract";
import { buildChapterContextSnapshot } from "./chapter-context-snapshot";
import { buildItemContextSnapshot } from "./item-context-snapshot";
import { buildLibraryQuestionContextSnapshot } from "./library-context-snapshot";
import { buildMockContextSnapshot } from "./mock-context-snapshot";
import { buildPlanContextSnapshot } from "./plan-context-snapshot";
import { buildSubjectContextSnapshot } from "./subject-context-snapshot";
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

/**
 * A subject is its goal's own, and a session's or practice's question comes from one, so they're
 * only ever asked about with that goal's plan.
 */
function needsGoalPlan(
  context: TutorScreenContext,
): context is ItemScopeContext | SubjectScopeContext {
  return context.scope.kind === "item" || context.scope.kind === "subject";
}

function toScreenSnapshot(contextSnapshot: TutorScreenContext | null): ScreenSnapshot {
  return contextSnapshot
    ? { contextSnapshot, status: "ready", stepId: null, stepNumber: null }
    : INVALID_CONTEXT;
}

/**
 * What the screen shows: a lesson's screens and answers from the step ids the client sent, or the
 * chapter, mock or subject as a whole, or a session's or practice's question. The context must
 * match the thing the thread is about.
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
    case "subject":
      return toScreenSnapshot(buildSubjectContextSnapshot(subject));
    case "item":
      return context.kind === "item"
        ? toScreenSnapshot(
            await buildItemContextSnapshot({ context, itemId: subject.item.id, userId }),
          )
        : INVALID_CONTEXT;
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
 * from a chapter, a lesson, a subject or a finished mock inside one of the learner's goals, goes
 * to the buddy with the goal's plan, plus the screen it came from: every place the buddy is asked
 * can read the plan, propose a change to it and offer the app's features. A learner without a
 * goal asks about the screen alone.
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
    // The buddy's own conversation is about the goal the app has open: its answers may link it.
    const contextSnapshot =
      context.kind === "plan"
        ? await buildPlanContextSnapshot(subject.goal, { conversation: true })
        : null;

    return contextSnapshot
      ? { contextSnapshot, status: "ready" as const, stepId: null, stepNumber: null }
      : INVALID_CONTEXT;
  }

  const [screen, plan] = await Promise.all([
    buildScreenSnapshot({ context, subject, userId }),
    buildScreenGoalSnapshot({ subject, userId }),
  ]);

  if (screen.status !== "ready") {
    return screen;
  }

  if (plan) {
    return { ...screen, contextSnapshot: { ...plan, screen: screen.contextSnapshot } };
  }

  const { contextSnapshot } = screen;
  return needsGoalPlan(contextSnapshot) ? INVALID_CONTEXT : { ...screen, contextSnapshot };
}
