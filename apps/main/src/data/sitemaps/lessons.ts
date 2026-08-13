import "server-only";
import {
  INDEXABLE_AUTHORED_LESSON_KINDS,
  INDEXABLE_CHAPTER_LESSON_KIND,
  INDEXABLE_EXPLANATION_COMPANION_LESSON_KINDS,
} from "@/lib/lessons/seo";
import { SPLIT_LESSON_SLUG_MARKER } from "@zoonk/core/lessons/split-lessons";
import { getPublishedLessonWhere, prisma } from "@zoonk/db";
import { SITEMAP_BATCH_SIZE } from "./courses";

/**
 * Keeps the lesson sitemap aligned with the route's indexing policy. Published
 * authored rows need their own metadata. Single-source companions need an
 * authored lesson in the same chapter, and the chapter-level review uses the
 * chapter title. Reading and listening stay excluded because they span several
 * topics without standalone metadata.
 */
function getSitemapLessonWhere() {
  return {
    AND: [
      getPublishedLessonWhere({ courseWhere: { organization: { kind: "brand" } } }),
      { NOT: { slug: { contains: SPLIT_LESSON_SLUG_MARKER } } },
      {
        OR: [
          {
            description: { not: "" },
            kind: { in: [...INDEXABLE_AUTHORED_LESSON_KINDS] },
            title: { not: "" },
          },
          {
            chapter: {
              lessons: {
                some: { isPublished: true, kind: "explanation" as const, title: { not: "" } },
              },
            },
            kind: { in: [...INDEXABLE_EXPLANATION_COMPANION_LESSON_KINDS] },
          },
          {
            chapter: {
              lessons: {
                some: { isPublished: true, kind: "vocabulary" as const, title: { not: "" } },
              },
            },
            kind: "translation" as const,
          },
          { kind: INDEXABLE_CHAPTER_LESSON_KIND },
        ],
      },
    ],
  };
}

/**
 * Counts every lesson URL that satisfies the same metadata policy used by the
 * lesson page's robots metadata.
 */
export async function countSitemapLessons(): Promise<number> {
  return prisma.lesson.count({ where: getSitemapLessonWhere() });
}

/**
 * Returns one deterministic sitemap page with the full public lesson route
 * hierarchy and the course language used by the canonical URL.
 */
export async function listSitemapLessons(
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
    include: { chapter: { include: { course: { include: { organization: true } } } } },
    orderBy: { id: "asc" },
    skip: page * SITEMAP_BATCH_SIZE,
    take: SITEMAP_BATCH_SIZE,
    where: getSitemapLessonWhere(),
  });

  return lessons.map((lesson) => ({
    brandSlug: lesson.chapter.course.organization?.slug ?? "",
    chapterSlug: lesson.chapter.slug,
    courseSlug: lesson.chapter.course.slug,
    language: lesson.chapter.course.language,
    lessonSlug: lesson.slug,
    updatedAt: lesson.updatedAt,
  }));
}
