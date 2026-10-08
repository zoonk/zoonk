import "server-only";
import { cacheTag } from "next/cache";
import {
  getCourseCacheTag,
  getCourseCurriculumCacheTag,
  getLibraryChapterCacheTag,
} from "../cache/tags";
import { getLibraryChapter } from "../library/chapters/get-library-chapter";
import { getCatalogChapterPlacement } from "./_utils/catalog-chapter";
import { getCatalogCourse } from "./_utils/catalog-course";
import { loadViewerFinishedLessons } from "./_utils/finished-lessons";
import { pickNextLesson } from "./_utils/next-lesson-pick";

type TargetCourse = { id: string; organization: { slug: string } | null; slug: string };
type TargetChapter = { id: string; lessons: readonly { id: string; slug: string }[]; slug: string };

type NextLessonTargetBase = {
  /** Null for a learner's private course, which has no brand and no public page. */
  brandSlug: string | null;
  chapterId: string;
  chapterSlug: string;
  courseId: string;
  courseSlug: string;
  hasStarted: boolean;
};

type CatalogNextLesson =
  | (NextLessonTargetBase & { canPrefetch: false; completed: false; type: "chapter" })
  | (NextLessonTargetBase & {
      canPrefetch: boolean;
      completed: boolean;
      lessonId: string;
      lessonPosition: number;
      lessonSlug: string;
      type: "lesson";
    });

type CatalogNextLessonResult =
  | { status: "notFound" }
  | { status: "ready"; target: CatalogNextLesson | null };

/** A lesson can be prefetched once its content is written. */
async function canPrefetchLesson({ chapterId, lessonId }: { chapterId: string; lessonId: string }) {
  const chapter = await getLibraryChapter({ chapterId });
  return chapter?.lessons.find((lesson) => lesson.id === lessonId)?.contentStatus === "completed";
}

function hasFinishedAny({
  chapters,
  finishedLessonIds,
}: {
  chapters: readonly TargetChapter[];
  finishedLessonIds: Set<string>;
}) {
  return chapters.some((chapter) =>
    chapter.lessons.some((lesson) => finishedLessonIds.has(lesson.id)),
  );
}

async function toTarget({
  chapters,
  course,
  finishedLessonIds,
}: {
  chapters: readonly TargetChapter[];
  course: TargetCourse;
  finishedLessonIds: Set<string>;
}): Promise<CatalogNextLesson | null> {
  const pick = pickNextLesson({ chapters, finishedLessonIds });

  if (!pick) {
    return null;
  }

  const base = {
    brandSlug: course.organization?.slug ?? null,
    chapterId: pick.chapter.id,
    chapterSlug: pick.chapter.slug,
    courseId: course.id,
    courseSlug: course.slug,
    hasStarted: hasFinishedAny({ chapters, finishedLessonIds }),
  };

  if (pick.kind === "chapter") {
    return { ...base, canPrefetch: false, completed: false, type: "chapter" };
  }

  return {
    ...base,
    canPrefetch: await canPrefetchLesson({ chapterId: pick.chapter.id, lessonId: pick.lesson.id }),
    completed: pick.completed,
    lessonId: pick.lesson.id,
    lessonPosition: pick.lessonPosition,
    lessonSlug: pick.lesson.slug,
    type: "lesson",
  };
}

/**
 * Where the learner goes next in a catalog course, from the lessons they finished (none without a
 * session). A null target means the course has no chapters yet; `notFound` means the viewer
 * can't open the course: it isn't a published brand course or their own private course.
 */
export async function getCatalogCourseNextLesson({
  courseId,
}: {
  courseId: string;
}): Promise<CatalogNextLessonResult> {
  "use cache: private";
  cacheTag(getCourseCacheTag(courseId), getCourseCurriculumCacheTag(courseId));

  const [catalog, { finishedLessonIds }] = await Promise.all([
    getCatalogCourse(courseId),
    loadViewerFinishedLessons(),
  ]);

  if (!catalog) {
    return { status: "notFound" };
  }

  const target = await toTarget({
    chapters: catalog.placements.map((placement) => placement.chapter),
    course: catalog.course,
    finishedLessonIds,
  });

  return { status: "ready", target };
}

/**
 * Where the learner goes next in a chapter, read in a catalog course (the given one or the
 * chapter's home course). A null target means the chapter's lessons aren't written yet.
 */
export async function getCatalogChapterNextLesson({
  chapterId,
  courseId,
}: {
  chapterId: string;
  courseId?: string;
}): Promise<CatalogNextLessonResult> {
  "use cache: private";
  cacheTag(getLibraryChapterCacheTag(chapterId));

  const [found, { finishedLessonIds }] = await Promise.all([
    getCatalogChapterPlacement({ chapterId, courseId }),
    loadViewerFinishedLessons(),
  ]);

  if (!found) {
    return { status: "notFound" };
  }

  if (found.chapter.lessons.length === 0) {
    return { status: "ready", target: null };
  }

  const target = await toTarget({
    chapters: [found.chapter],
    course: found.course,
    finishedLessonIds,
  });

  return { status: "ready", target };
}
