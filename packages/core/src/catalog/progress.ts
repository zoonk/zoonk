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

/** Returns null for an inaccessible course, and no progress without a session. */
export async function getCatalogCourseProgress({ courseId }: { courseId: string }) {
  "use cache: private";
  cacheTag(getCourseCacheTag(courseId), getCourseCurriculumCacheTag(courseId));

  const catalog = await getCatalogCourse(courseId);

  if (!catalog) {
    return null;
  }

  const { finishedLessonIds, signedIn } = await loadViewerFinishedLessons(
    catalog.placements.flatMap(({ chapter }) => chapter.lessons.map((lesson) => lesson.id)),
  );

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

/** Returns null for an inaccessible chapter; progress is shared across its course placements. */
export async function getCatalogChapterProgress({ chapterId }: { chapterId: string }) {
  "use cache: private";
  cacheTag(getLibraryChapterCacheTag(chapterId));

  const chapter = await getLibraryChapter({ chapterId });

  if (!chapter) {
    return null;
  }

  const { finishedLessonIds, signedIn } = await loadViewerFinishedLessons(
    chapter.lessons.map((lesson) => lesson.id),
  );

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
