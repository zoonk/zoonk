import "server-only";
import {
  type ItemScopeContext,
  type PlanScopeContext,
  type SubjectScopeContext,
  type TutorScreenContext,
} from "@zoonk/ai/tasks/lessons/question-context";
import { prisma } from "@zoonk/db";
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

/**
 * Whether the screen's own Library row (its lesson or chapter, with its home course, or its
 * question's skill) was written for this learner alone, so its words are as personal as theirs. A
 * subject's and a mock's words come from the goal's course or the exam: the plan marks a course
 * of the learner's own.
 */
async function isOwnScreen(subject: ScreenSubject): Promise<boolean> {
  switch (subject.kind) {
    case "lesson": {
      const { lesson } = subject;
      const chapter = lesson.homeChapter;

      return [lesson, chapter, chapter?.homeCourse].some((row) => row?.visibility === "private");
    }
    case "chapter": {
      const chapter = await prisma.chapter.findUnique({
        select: { homeCourse: { select: { visibility: true } }, visibility: true },
        where: { id: subject.chapterId },
      });

      return [chapter, chapter?.homeCourse].some((row) => row?.visibility === "private");
    }
    case "item": {
      const item = await prisma.item.findUnique({
        select: { skill: { select: { visibility: true } } },
        where: { id: subject.item.id },
      });

      return item?.skill.visibility === "private";
    }
    case "mock":
    case "subject":
      return false;
    default:
      return subject satisfies never;
  }
}

/** The goal a screen belongs to and its plan, as the buddy reads it; null without one. */
async function buildScreenGoalSnapshot({
  subject,
  userId,
}: {
  subject: ScreenSubject;
  userId: string;
}): Promise<{ goalId: string; plan: PlanScopeContext } | null> {
  const goal = await findSubjectGoal({ subject, userId });
  const plan = goal ? await buildPlanContextSnapshot(goal) : null;

  return goal && plan ? { goalId: goal.id, plan } : null;
}

/**
 * What the tutor sees for a new question, built on the server. A question about the plan, or
 * from a chapter, a lesson, a subject or a finished mock inside one of the learner's goals, goes
 * to the buddy with the goal's plan, plus the screen it came from: every place the buddy is asked
 * can read the plan, propose a change to it and offer the app's features. A learner without a
 * goal asks about the screen alone. `goalId` is the goal whose plan the snapshot holds: the
 * question keeps it, so its answer reads and acts on that goal alone (see `findAnsweringGoal`).
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
      ? {
          contextSnapshot,
          goalId: subject.goal.id,
          status: "ready" as const,
          stepId: null,
          stepNumber: null,
        }
      : INVALID_CONTEXT;
  }

  const [screen, goalPlan, ownScreen] = await Promise.all([
    buildScreenSnapshot({ context, subject, userId }),
    buildScreenGoalSnapshot({ subject, userId }),
    isOwnScreen(subject),
  ]);

  if (screen.status !== "ready") {
    return screen;
  }

  if (goalPlan) {
    const contextSnapshot = {
      ...goalPlan.plan,
      // The plan's own marks, and the screen's: a plan without one reads as private.
      privateContent: ownScreen || goalPlan.plan.privateContent !== false,
      screen: screen.contextSnapshot,
    };

    return { ...screen, contextSnapshot, goalId: goalPlan.goalId };
  }

  const { contextSnapshot } = screen;

  return needsGoalPlan(contextSnapshot)
    ? INVALID_CONTEXT
    : { ...screen, contextSnapshot, goalId: null };
}
