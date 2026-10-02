import "server-only";
import { cacheTag } from "next/cache";
import {
  getCourseCacheTag,
  getCourseCurriculumCacheTag,
  getLibraryChapterCacheTag,
} from "../cache/tags";
import { getLibraryChapter } from "../library/chapters/get-library-chapter";
import {
  calculateCourseContinueProgressPercent,
  calculateProgressPercent,
} from "../progress/calculate-continue-progress";
import { type CatalogPlacement, getCatalogCourse } from "./_utils/catalog-course";
import { loadViewerFinishedLessons } from "./_utils/finished-lessons";

function countFinished({
  finishedLessonIds,
  lessons,
}: {
  finishedLessonIds: Set<string>;
  lessons: readonly { id: string }[];
}) {
  return lessons.filter((lesson) => finishedLessonIds.has(lesson.id)).length;
}

/**
 * A chapter whose lesson outline isn't written yet counts as pending, so the course percentage
 * estimates its size from the chapters that are written instead of reading 100% too early.
 */
function toChapterProgress({
  finishedLessonIds,
  placement,
}: {
  finishedLessonIds: Set<string>;
  placement: CatalogPlacement;
}) {
  const { lessons } = placement.chapter;

  return {
    chapterId: placement.chapter.id,
    completedLessons: countFinished({ finishedLessonIds, lessons }),
    outlineStatus: placement.chapter.outlineStatus,
    totalLessons: lessons.length,
  };
}

/**
 * The signed-in learner's progress in a catalog course: finished lessons per chapter in reading
 * order and the course percentage. Null when the course isn't in the catalog; without a session
 * there's no progress to show.
 */
export async function getCatalogCourseProgress({ courseId }: { courseId: string }) {
  "use cache: private";
  cacheTag(getCourseCacheTag(courseId), getCourseCurriculumCacheTag(courseId));

  const [catalog, { finishedLessonIds, signedIn }] = await Promise.all([
    getCatalogCourse(courseId),
    loadViewerFinishedLessons(),
  ]);

  if (!catalog) {
    return null;
  }

  if (!signedIn) {
    return { chapters: [], percentComplete: null };
  }

  const chapters = catalog.placements.map((placement) =>
    toChapterProgress({ finishedLessonIds, placement }),
  );

  return {
    chapters: chapters.map(({ chapterId, completedLessons, totalLessons }) => ({
      chapterId,
      completedLessons,
      totalLessons,
    })),
    percentComplete: calculateCourseContinueProgressPercent({ chapters }),
  };
}

/**
 * The signed-in learner's finished lessons in a chapter and its percentage. A chapter's progress
 * is the same in every course that places it, so it needs no course. Null when the chapter
 * doesn't exist or is private to someone else.
 */
export async function getCatalogChapterProgress({ chapterId }: { chapterId: string }) {
  "use cache: private";
  cacheTag(getLibraryChapterCacheTag(chapterId));

  const [chapter, { finishedLessonIds, signedIn }] = await Promise.all([
    getLibraryChapter({ chapterId }),
    loadViewerFinishedLessons(),
  ]);

  if (!chapter) {
    return null;
  }

  if (!signedIn) {
    return { lessons: [], percentComplete: null };
  }

  return {
    lessons: chapter.lessons.map((lesson) => ({
      isCompleted: finishedLessonIds.has(lesson.id),
      lessonId: lesson.id,
    })),
    percentComplete: calculateProgressPercent({
      completedItems: countFinished({ finishedLessonIds, lessons: chapter.lessons }),
      totalItems: chapter.lessons.length,
    }),
  };
}
