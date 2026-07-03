import {
  type CourseLandingPageContent,
  parseCourseLandingPageContent,
} from "@zoonk/core/courses/landing-page";
import { type CourseGetPayload } from "@zoonk/db";

export const courseContentInclude = {
  _count: { select: { categories: true, chapters: true } },
  chapters: { select: { _count: { select: { lessons: true } }, position: true } },
} as const;

export type CourseWithContentCounts = CourseGetPayload<{ include: typeof courseContentInclude }>;

export type ExistingCourseContent = {
  chapterCount: number;
  description: string | null;
  imageUrl: string | null;
  hasCategories: boolean;
  hasIntroductionLessons: boolean;
  hasMainCurriculum: boolean;
  landingPage: CourseLandingPageContent | null;
};

export const EMPTY_EXISTING_CONTENT: ExistingCourseContent = {
  chapterCount: 0,
  description: null,
  hasCategories: false,
  hasIntroductionLessons: false,
  hasMainCurriculum: false,
  imageUrl: null,
  landingPage: null,
};

/**
 * Existing courses may predate this generated copy or contain edited JSON, so
 * setup only treats the landing page as reusable when it still matches the
 * structured copy contract the course page can render.
 */
function getExistingLandingPage(course: CourseWithContentCounts): CourseLandingPageContent | null {
  return parseCourseLandingPageContent(course.landingPage);
}

/**
 * Course setup only needs to know which persisted content already exists.
 * Keeping that shape small prevents duplicate-run recovery from passing full
 * Prisma rows through workflow branches that only decide what generation to
 * skip.
 */
export function getExistingCourseContent(course: CourseWithContentCounts): ExistingCourseContent {
  const chapterCount = course._count.chapters;

  const introductionChapter = course.targetLanguage
    ? null
    : (course.chapters.find((chapter) => chapter.position === 0) ?? null);

  const hasIntroductionLessons = Boolean(introductionChapter?._count.lessons);

  const hasMainCurriculum = course.targetLanguage
    ? chapterCount > 0
    : course.chapters.some((chapter) => chapter.position > 0);

  return {
    chapterCount,
    description: course.description,
    hasCategories: course._count.categories > 0,
    hasIntroductionLessons,
    hasMainCurriculum,
    imageUrl: course.imageUrl,
    landingPage: getExistingLandingPage(course),
  };
}
