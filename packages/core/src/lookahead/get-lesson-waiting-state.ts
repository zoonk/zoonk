import "server-only";
import { prisma } from "@zoonk/db";
import { io } from "next/cache";
import {
  type LessonGenerationState,
  getLessonGenerationState,
} from "../library/generation/lesson-generation-state";
import { findViewerLesson } from "./_utils/viewer-lesson";

type ReadyAlternative =
  | { kind: "lesson"; lessonId: string; title: string }
  | { dueSkills: number; kind: "review" };

type LessonWaitingState = {
  status: LessonGenerationState["status"];
  /** The run writing the lesson: stream `/v1/generations/{generationId}/events` for live progress. */
  generationId: string | null;
  /** Null when the lesson is ready, or when nothing else is ready either. */
  alternative: ReadyAlternative | null;
  /** A failed lesson its checks set aside: it's never written again, so there's nothing to retry. */
  setAside: boolean;
  /** The goal's ready warm-up deck, only while its first lesson is being waited for. */
  warmUpId: string | null;
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
 * A learner well into a goal doesn't get its beginner cards again. Finished lesson runs count
 * without their lessons, so one whose lesson was deleted still does.
 */
async function findFirstLessonWarmUp({
  lessonId,
  userId,
}: {
  lessonId: string;
  userId: string;
}): Promise<string | null> {
  const [goal] = await prisma.$queryRaw<{ warmUpId: string }[]>`
    SELECT g.warm_up_id AS "warmUpId"
    FROM goals g
    WHERE g.user_id = ${userId}::uuid
      AND g.status <> 'archived'
      AND g.warm_up_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM plan_items item JOIN plans plan ON plan.id = item.plan_id
        WHERE plan.goal_id = g.id AND item.lesson_id = ${lessonId}::uuid
      )
      AND NOT EXISTS (
        SELECT 1 FROM learning_events run
        WHERE run.user_id = g.user_id
          AND run.kind IN ('lesson', 'review')
          AND run.lesson_kind = 'library'
          AND run.ended_at IS NOT NULL
          AND (
            run.goal_id = g.id
            OR EXISTS (
              SELECT 1 FROM plan_items item JOIN plans plan ON plan.id = item.plan_id
              WHERE plan.goal_id = g.id
                AND item.lesson_id = (run.content_ids->>'lessonId')::uuid
            )
          )
      )
    LIMIT 1`;

  return goal?.warmUpId ?? null;
}

/** Uncached polling read; missing generationId means the page must request generation after a learner action. */
export async function getLessonWaitingState({
  lessonId,
}: {
  lessonId: string;
}): Promise<LessonWaitingResult> {
  const viewer = await findViewerLesson(lessonId);

  if (viewer.status !== "ready") {
    return viewer;
  }

  // Next's io boundary keeps live request time out of prerendering.
  await io();

  const state = await getLessonGenerationState(lessonId);

  if (!state) {
    return { status: "notFound" };
  }

  if (state.status === "ready") {
    return {
      state: {
        alternative: null,
        generationId: null,
        setAside: false,
        status: "ready",
        warmUpId: null,
      },
      status: "ready",
    };
  }

  const [alternative, warmUpId] = await Promise.all([
    findReadyAlternative({ lessonId, userId: viewer.userId }),
    findFirstLessonWarmUp({ lessonId, userId: viewer.userId }),
  ]);

  return {
    state: {
      alternative,
      generationId: state.status === "generating" ? state.runId : null,
      setAside: state.status === "failed" && state.setAside,
      status: state.status,
      warmUpId,
    },
    status: "ready",
  };
}
