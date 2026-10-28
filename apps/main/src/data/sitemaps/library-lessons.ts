import "server-only";
import { QUICK_LESSON_KEY_WHERE } from "@zoonk/core/library/quick-lessons/identity";
import { prisma } from "@zoonk/db";
import { getSitemapCourseWhere } from "./course-where";
import { getSitemapPageRowIds, isSitemapPage, warnIfSitemapPageIsFull } from "./sitemap-pages";

/**
 * A shared lesson is listed once, at its home placement, which is also its canonical URL. A skill's
 * quick lesson isn't listed: no chapter lists it.
 */
async function getSitemapLibraryLessonWhere() {
  return {
    NOT: QUICK_LESSON_KEY_WHERE,
    homeChapter: { homeCourse: await getSitemapCourseWhere(), visibility: "public" as const },
    visibility: "public" as const,
  };
}

type SitemapLesson = {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  language: string;
  lessonSlug: string;
  updatedAt: Date;
};

async function listSitemapLibraryLessonPage(page: number): Promise<SitemapLesson[]> {
  "use cache";

  const where = await getSitemapLibraryLessonWhere();
  const listed = await prisma.lesson.findMany({ select: { id: true }, where });
  const ids = getSitemapPageRowIds({ listed, page, resource: "library-lessons" });
  warnIfSitemapPageIsFull({ page, resource: "library-lessons", rows: ids.length });

  const lessons = await prisma.lesson.findMany({
    orderBy: { id: "asc" },
    select: {
      homeChapter: {
        select: {
          homeCourse: {
            select: { language: true, organization: { select: { slug: true } }, slug: true },
          },
          slug: true,
        },
      },
      slug: true,
      updatedAt: true,
    },
    where: { ...where, id: { in: ids } },
  });

  return lessons.flatMap(({ homeChapter, slug, updatedAt }) =>
    homeChapter?.homeCourse
      ? [
          {
            brandSlug: homeChapter.homeCourse.organization?.slug ?? "",
            chapterSlug: homeChapter.slug,
            courseSlug: homeChapter.homeCourse.slug,
            language: homeChapter.homeCourse.language,
            lessonSlug: slug,
            updatedAt,
          },
        ]
      : [],
  );
}

export async function listSitemapLibraryLessons(page: number): Promise<SitemapLesson[]> {
  return isSitemapPage({ page, resource: "library-lessons" })
    ? listSitemapLibraryLessonPage(page)
    : [];
}
