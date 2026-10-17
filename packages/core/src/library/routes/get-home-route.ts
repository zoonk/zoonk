import "server-only";
import { type LibraryVisibility, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { cacheTag } from "next/cache";
import {
  getCourseCacheTag,
  getLibraryChapterCacheTag,
  getLibraryLessonCacheTag,
} from "../../cache/tags";

const homeCourseSelect = {
  id: true,
  isPublished: true,
  language: true,
  organization: { select: { kind: true, slug: true } },
  slug: true,
  visibility: true,
} as const;

const homeChapterSelect = {
  homeCourse: { select: homeCourseSelect },
  id: true,
  slug: true,
  visibility: true,
} as const;

type HomeCourse = {
  isPublished: boolean;
  language: string;
  organization: { kind: string; slug: string } | null;
  slug: string;
  visibility: LibraryVisibility;
};

type CourseRoute = { brandSlug: string; courseSlug: string; language: string };
export type ChapterRoute = CourseRoute & { chapterSlug: string };
export type LessonRoute = ChapterRoute & { lessonSlug: string };

/** Only a published, public brand course has a public URL a canonical link can point to. */
function toCourseRoute(course: HomeCourse | null): CourseRoute | null {
  if (!course?.isPublished || course.visibility !== "public") {
    return null;
  }

  if (course.organization?.kind !== "brand") {
    return null;
  }

  return {
    brandSlug: course.organization.slug,
    courseSlug: course.slug,
    language: course.language,
  };
}

function toChapterRoute(
  chapter: { homeCourse: HomeCourse | null; slug: string; visibility: LibraryVisibility } | null,
): ChapterRoute | null {
  if (chapter?.visibility !== "public") {
    return null;
  }

  const courseRoute = toCourseRoute(chapter.homeCourse);
  return courseRoute ? { ...courseRoute, chapterSlug: chapter.slug } : null;
}

async function getCachedChapterHomeRoute(chapterId: string) {
  "use cache";
  cacheTag(getLibraryChapterCacheTag(chapterId));

  const chapter = await prisma.chapter.findUnique({
    select: homeChapterSelect,
    where: { id: chapterId },
  });

  if (chapter?.homeCourse) {
    cacheTag(getCourseCacheTag(chapter.homeCourse.id));
  }

  return toChapterRoute(chapter);
}

async function getCachedLessonHomeRoute(lessonId: string) {
  "use cache";
  cacheTag(getLibraryLessonCacheTag(lessonId));

  const lesson = await prisma.lesson.findUnique({
    select: { homeChapter: { select: homeChapterSelect }, slug: true, visibility: true },
    where: { id: lessonId },
  });

  const homeChapter = lesson?.homeChapter ?? null;

  if (homeChapter) {
    cacheTag(getLibraryChapterCacheTag(homeChapter.id));
  }

  if (homeChapter?.homeCourse) {
    cacheTag(getCourseCacheTag(homeChapter.homeCourse.id));
  }

  const chapterRoute = lesson?.visibility === "public" ? toChapterRoute(homeChapter) : null;
  return chapterRoute && lesson ? { ...chapterRoute, lessonSlug: lesson.slug } : null;
}

/**
 * The URL of a shared chapter's home placement: the course it was made for.
 * Every other course that reuses the chapter points its canonical link here,
 * so search engines see one page per chapter. Null when the home has no
 * public URL.
 */
export async function getChapterHomeRoute({
  chapterId,
}: {
  chapterId: string;
}): Promise<ChapterRoute | null> {
  if (!isUuid(chapterId)) {
    return null;
  }

  return getCachedChapterHomeRoute(chapterId);
}

/**
 * The URL of a shared lesson's home placement: the chapter it was made for,
 * inside that chapter's home course. Reused placements point their canonical
 * link here. Null when the home has no public URL.
 */
export async function getLessonHomeRoute({
  lessonId,
}: {
  lessonId: string;
}): Promise<LessonRoute | null> {
  if (!isUuid(lessonId)) {
    return null;
  }

  return getCachedLessonHomeRoute(lessonId);
}
