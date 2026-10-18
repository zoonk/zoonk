import "server-only";
import { type Lesson, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLibraryLessonCacheTag } from "../../cache/tags";
import { parseHeldBackDrafts } from "./held-back-drafts";

/**
 * Where a lesson's content stands. `generating` names the run writing it (its spec, then its
 * screens), so a second request follows that run instead of starting another. `failed` says how
 * many drafts the quality gate held back (none when a run stopped) and whether the lesson was set
 * aside after its last one, so nothing writes it again.
 */
export type LessonGenerationState =
  | { status: "ready" }
  | { runId: string; status: "generating" }
  | { status: "notStarted" }
  | { heldBackDrafts: number; setAside: boolean; status: "failed" };

type StateRow = Pick<Lesson, "contentRunId" | "contentStatus" | "heldBackDrafts" | "setAsideAt">;

/** Reads a lesson row's generation columns as the state waiting screens and workflows act on. */
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

/**
 * The generation state of each lesson, uncached: workflows and waiting screens poll it while
 * content is being written. Lessons that no longer exist are left out.
 */
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

/**
 * A lesson the quality gate held back that still has drafts left: the next run drafts it again,
 * told what held the earlier drafts back.
 */
export function canRedraftLesson(state: LessonGenerationState | null | undefined): boolean {
  return state?.status === "failed" && state.heldBackDrafts > 0 && !state.setAside;
}

/** One lesson's generation state, or null when the lesson no longer exists. */
export async function getLessonGenerationState(
  lessonId: string,
): Promise<LessonGenerationState | null> {
  const states = await getLessonGenerationStates([lessonId]);
  return states.get(lessonId) ?? null;
}

/**
 * Frees a lesson whose content claim is held by a run that is no longer running (it crashed or was
 * cancelled before it could end its claim), so the next run can claim it. Only that run's claim
 * changes: a lesson another run took over meanwhile is left alone.
 */
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
