import "server-only";
import { listCourses } from "@zoonk/core/courses/list";
import { getLibraryCourse } from "@zoonk/core/library/courses/get";
import UNLISTED_ROUTE from "./catalog-placeholder.json";

/** Every other page is written on its first request and kept, so the build stays short as the catalog grows. */
const PRERENDERED_COURSES = 12;

async function getPrerenderedCourses(lang: string) {
  const courses = await listCourses({ language: lang, limit: PRERENDERED_COURSES });

  return courses.map((course) => ({
    brandSlug: course.organization.slug,
    courseId: course.id,
    courseSlug: course.slug,
  }));
}

async function getPrerenderedOutlines(lang: string) {
  const courses = await getPrerenderedCourses(lang);

  const outlines = await Promise.all(
    courses.map(async (course) => ({
      course,
      outline: await getLibraryCourse({ courseId: course.courseId }),
    })),
  );

  return outlines.map(({ course, outline }) => ({
    brandSlug: course.brandSlug,
    chapters: outline?.levels.flatMap((band) => band.chapters) ?? [],
    courseSlug: course.courseSlug,
  }));
}

function orUnlisted<T extends object>(params: T[], unlisted: T): T[] {
  return params.length > 0 ? params : [unlisted];
}

export async function getCourseStaticParams(lang: string) {
  const courses = await getPrerenderedCourses(lang);

  return orUnlisted(
    courses.map(({ brandSlug, courseSlug }) => ({ brandSlug, courseSlug })),
    { brandSlug: UNLISTED_ROUTE.brandSlug, courseSlug: UNLISTED_ROUTE.courseSlug },
  );
}

export async function getChapterStaticParams(lang: string) {
  const outlines = await getPrerenderedOutlines(lang);

  return orUnlisted(
    outlines.flatMap(({ brandSlug, chapters, courseSlug }) => {
      const [chapter] = chapters;
      return chapter ? [{ brandSlug, chapterSlug: chapter.slug, courseSlug }] : [];
    }),
    {
      brandSlug: UNLISTED_ROUTE.brandSlug,
      chapterSlug: UNLISTED_ROUTE.chapterSlug,
      courseSlug: UNLISTED_ROUTE.courseSlug,
    },
  );
}

export async function getLessonStaticParams(lang: string) {
  const outlines = await getPrerenderedOutlines(lang);

  return orUnlisted(
    outlines.flatMap(({ brandSlug, chapters, courseSlug }) => {
      const chapter = chapters.find((item) => item.lessons.length > 0);
      const [lesson] = chapter?.lessons ?? [];

      return chapter && lesson
        ? [{ brandSlug, chapterSlug: chapter.slug, courseSlug, lessonSlug: lesson.slug }]
        : [];
    }),
    UNLISTED_ROUTE,
  );
}
