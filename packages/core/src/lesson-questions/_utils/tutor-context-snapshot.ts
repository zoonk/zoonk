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

/** Item and subject questions require their owning goal's plan. */
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

/** Returned goalId must be saved on the question; later answer tools may act on that goal only. */
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
      // Treat unmarked plans as private alongside the screen's own privacy mark.
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
