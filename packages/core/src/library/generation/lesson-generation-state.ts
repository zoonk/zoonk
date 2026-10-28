import "server-only";
import { type Lesson, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag } from "../../cache/tags";
import { parseHeldBackDrafts } from "./held-back-drafts";

export type LessonGenerationState =
  | { status: "ready" }
  | { runId: string; status: "generating" }
  | { status: "notStarted" }
  | { heldBackDrafts: number; setAside: boolean; status: "failed" };

type StateRow = Pick<Lesson, "contentRunId" | "contentStatus" | "heldBackDrafts" | "setAsideAt">;

function toLessonGenerationState(lesson: StateRow): LessonGenerationState {
  if (lesson.contentStatus === "completed") {
    return { status: "ready" };
  }

  if (lesson.contentStatus === "running" && lesson.contentRunId) {
    return { runId: lesson.contentRunId, status: "generating" };
  }

  if (lesson.contentStatus === "failed") {
    return {
      heldBackDrafts: parseHeldBackDrafts(lesson.heldBackDrafts).length,
      setAside: lesson.setAsideAt !== null,
      status: "failed",
    };
  }

  return { status: "notStarted" };
}

export async function getLessonGenerationStates(
  lessonIds: readonly string[],
): Promise<Map<string, LessonGenerationState>> {
  const lessons = await prisma.lesson.findMany({
    select: {
      contentRunId: true,
      contentStatus: true,
      heldBackDrafts: true,
      id: true,
      setAsideAt: true,
    },
    where: { id: { in: [...lessonIds] } },
  });

  return new Map(lessons.map((lesson) => [lesson.id, toLessonGenerationState(lesson)]));
}

export function canRedraftLesson(state: LessonGenerationState | null | undefined): boolean {
  return state?.status === "failed" && state.heldBackDrafts > 0 && !state.setAside;
}

export async function getLessonGenerationState(
  lessonId: string,
): Promise<LessonGenerationState | null> {
  const states = await getLessonGenerationStates([lessonId]);
  return states.get(lessonId) ?? null;
}

export async function releaseStaleLessonClaims({
  lessonId,
  staleRunId,
}: {
  lessonId: string;
  staleRunId: string;
}): Promise<boolean> {
  const [content, spec] = await prisma.$transaction([
    prisma.lesson.updateMany({
      data: { contentStatus: "failed" },
      where: { contentRunId: staleRunId, contentStatus: "running", id: lessonId },
    }),
    prisma.lesson.updateMany({
      data: { specStatus: "failed" },
      where: { id: lessonId, specRunId: staleRunId, specStatus: "running" },
    }),
  ]);

  const released = content.count + spec.count > 0;

  if (released) {
    revalidateCacheTags([getLibraryLessonCacheTag(lessonId)]);
  }

  return released;
}
