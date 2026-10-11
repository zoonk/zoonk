import "server-only";
import { QUICK_LESSON_KEY_WHERE } from "@zoonk/core/library/quick-lessons/identity";
import { prisma } from "@zoonk/db";
import { getSitemapCourseWhere } from "./course-where";
import { SITEMAP_BATCH_SIZE } from "./courses";

/**
 * A shared lesson is listed once, at its home placement, which is also its
 * canonical URL. Lessons whose content isn't written yet are listed too: their
 * page has the title, what it's about and where it fits, and "Start this
 * lesson" writes it. A skill's quick lesson isn't: no chapter lists it, it only
 * stands in for the skill's lessons in a plan that chose it.
 */
async function getSitemapLibraryLessonWhere() {
  return {
    NOT: QUICK_LESSON_KEY_WHERE,
    homeChapter: { homeCourse: await getSitemapCourseWhere(), visibility: "public" as const },
    visibility: "public" as const,
  };
}

export async function countSitemapLibraryLessons(): Promise<number> {
  return prisma.lesson.count({ where: await getSitemapLibraryLessonWhere() });
}

export async function listSitemapLibraryLessons(
  page: number,
): Promise<
  {
    brandSlug: string;
    chapterSlug: string;
    courseSlug: string;
    language: string;
    lessonSlug: string;
    updatedAt: Date;
  }[]
> {
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
    skip: page * SITEMAP_BATCH_SIZE,
    take: SITEMAP_BATCH_SIZE,
    where: await getSitemapLibraryLessonWhere(),
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
