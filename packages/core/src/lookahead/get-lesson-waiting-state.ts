import "server-only";
import { prisma } from "@zoonk/db";
import { io } from "next/cache";
import {
  type LessonGenerationState,
  getLessonGenerationState,
} from "../library/generation/lesson-generation-state";
import { findViewerLesson } from "./_utils/viewer-lesson";

/** Something ready to do instead of waiting: the next written lesson of the plan, or due reviews. */
type ReadyAlternative =
  | { kind: "lesson"; lessonId: string; title: string }
  | { dueSkills: number; kind: "review" };

type LessonWaitingState = {
  status: LessonGenerationState["status"];
  /** The run writing the lesson: stream `/v1/generations/{generationId}/events` for live progress. */
  generationId: string | null;
  /** Null when the lesson is ready, or when nothing else is ready either. */
  alternative: ReadyAlternative | null;
};

export type LessonWaitingResult =
  | { state: LessonWaitingState; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

async function findNextReadyLesson({ lessonId, userId }: { lessonId: string; userId: string }) {
  const item = await prisma.planItem.findFirst({
    orderBy: { position: "asc" },
    select: { lesson: { select: { id: true, title: true } } },
    where: {
      lesson: { contentStatus: "completed", id: { not: lessonId } },
      plan: { goal: { activeProfile: { userId } } },
      status: "todo",
    },
  });

  return item?.lesson
    ? { kind: "lesson" as const, lessonId: item.lesson.id, title: item.lesson.title }
    : null;
}

async function findReadyAlternative({
  lessonId,
  userId,
}: {
  lessonId: string;
  userId: string;
}): Promise<ReadyAlternative | null> {
  const [lesson, dueSkills] = await Promise.all([
    findNextReadyLesson({ lessonId, userId }),
    prisma.learnerSkill.count({ where: { due: { lte: new Date() }, userId } }),
  ]);

  if (lesson) {
    return lesson;
  }

  return dueSkills > 0 ? { dueSkills, kind: "review" } : null;
}

/**
 * What the lesson page shows while a lesson isn't written yet ("never a dead end"): whether a run
 * is writing it and which one, so the page streams its live progress, or nothing is, so the
 * page asks for it; and a ready alternative from the learner's plan (the
 * next written lesson, or reviews that are due) instead of a spinner. Uncached: the page polls it
 * while it waits.
 */
export async function getLessonWaitingState({
  lessonId,
}: {
  lessonId: string;
}): Promise<LessonWaitingResult> {
  const viewer = await findViewerLesson(lessonId);

  if (viewer.status !== "ready") {
    return viewer;
  }

  // Live, like the run it follows: what's due now is read at request time, never in a prerender.
  await io();

  const state = await getLessonGenerationState(lessonId);

  if (!state) {
    return { status: "notFound" };
  }

  if (state.status === "ready") {
    return { state: { alternative: null, generationId: null, status: "ready" }, status: "ready" };
  }

  return {
    state: {
      alternative: await findReadyAlternative({ lessonId, userId: viewer.userId }),
      generationId: state.status === "generating" ? state.runId : null,
      status: state.status,
    },
    status: "ready",
  };
}
