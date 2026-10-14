import "server-only";
import { listCourses } from "@zoonk/core/courses/list";
import { getLibraryCourse } from "@zoonk/core/library/courses/get";

/**
 * How many of a language's most popular listed courses the build writes ahead, each with its first
 * chapter and its first lesson: where search results and the footer's popular courses send most
 * visitors. Every other course, chapter and lesson page is written on its first request and kept
 * from then on, so the build stays short however large the catalog grows.
 */
const PRERENDERED_COURSES = 12;

/**
 * An address the catalog never links, whose page is the catalog's not-found page. Next.js checks
 * each page is static on one written address per language at least, and a language without
 * listed courses (or without a written lesson yet) has no real one to offer.
 */
const UNLISTED_ROUTE = { brandSlug: "-", chapterSlug: "-", courseSlug: "-", lessonSlug: "-" };

/** A language's most popular listed courses, by the route segments their pages live at. */
async function getPrerenderedCourses(lang: string) {
  const courses = await listCourses({ language: lang, limit: PRERENDERED_COURSES });

  return courses.map((course) => ({
    brandSlug: course.organization.slug,
    courseId: course.id,
    courseSlug: course.slug,
  }));
}

/** Each prerendered course's outline chapters in order, with their lessons. */
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

/** At least one parameter set, falling back to the unlisted address. */
function orUnlisted<T extends object>(params: T[], unlisted: T): T[] {
  return params.length > 0 ? params : [unlisted];
}

/** The course pages the build writes for a UI language: its most popular courses. */
export async function getCourseStaticParams(lang: string) {
  const courses = await getPrerenderedCourses(lang);

  return orUnlisted(
    courses.map(({ brandSlug, courseSlug }) => ({ brandSlug, courseSlug })),
    { brandSlug: UNLISTED_ROUTE.brandSlug, courseSlug: UNLISTED_ROUTE.courseSlug },
  );
}

/** The chapter pages the build writes for a UI language: each popular course's first chapter. */
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

/** The lesson pages the build writes for a UI language: each popular course's first lesson. */
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
