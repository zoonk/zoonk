"use server";

import { searchChapters } from "@zoonk/core/chapters/search";
import { searchCourses } from "@zoonk/core/courses/search";

const COMMAND_PALETTE_CHAPTER_LIMIT = 5;

export type CatalogSearchResults = {
  courses: CourseSearchResult[];
  chapters: ChapterSearchResult[];
};

export type CourseSearchResult = {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  imageUrl: string | null;
  language: string;
  brandSlug: string;
};

export type ChapterSearchResult = {
  id: string;
  title: string;
  description: string;
  slug: string;
  imageUrl: string | null;
  language: string;
  courseTitle: string;
  courseSlug: string;
  brandSlug: string;
};

/**
 * The command palette needs a small, serialized catalog payload instead of raw
 * Prisma rows. Keeping that shaping in the server action lets the client render
 * courses and chapters without receiving fields it never displays.
 */
export async function searchCatalogAction(params: {
  query: string;
  language: string;
}): Promise<CatalogSearchResults> {
  const searchParams = { filterByLanguage: true, language: params.language, query: params.query };

  const [courses, chapters] = await Promise.all([
    searchCourses(searchParams),
    searchChapters({ ...searchParams, limit: COMMAND_PALETTE_CHAPTER_LIMIT }),
  ]);

  return {
    chapters: chapters.map((chapter) => ({
      brandSlug: chapter.course.organization.slug,
      courseSlug: chapter.course.slug,
      courseTitle: chapter.course.title,
      description: chapter.description,
      id: chapter.id,
      imageUrl: chapter.imageUrl,
      language: chapter.language,
      slug: chapter.slug,
      title: chapter.title,
    })),
    courses: courses.map((course) => ({
      brandSlug: course.organization.slug,
      description: course.description,
      id: course.id,
      imageUrl: course.imageUrl,
      language: course.language,
      slug: course.slug,
      title: course.title,
    })),
  };
}
