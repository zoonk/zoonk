import "server-only";
import { searchChapters } from "../chapters/search-chapters";
import { searchCourses } from "../courses/search-courses";

const CATALOG_CHAPTER_SEARCH_LIMIT = 5;

type SearchChapter = Awaited<ReturnType<typeof searchChapters>>[number];
type SearchCourse = Awaited<ReturnType<typeof searchCourses>>[number];

export type CatalogSearchResults = {
  chapters: ChapterSearchResult[];
  courses: CourseSearchResult[];
};

export type CourseSearchResult = {
  brandSlug: string;
  description: string | null;
  id: string;
  imageUrl: string | null;
  language: string;
  slug: string;
  title: string;
};

export type ChapterSearchResult = {
  brandSlug: string;
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  description: string;
  id: string;
  imageUrl: string | null;
  language: string;
  slug: string;
  title: string;
};

/**
 * Converts a published course search row into the small catalog result shared
 * by delivery apps without exposing the complete database model.
 */
function toCourseSearchResult(course: SearchCourse): CourseSearchResult {
  return {
    brandSlug: course.organization.slug,
    description: course.description,
    id: course.id,
    imageUrl: course.imageUrl,
    language: course.language,
    slug: course.slug,
    title: course.title,
  };
}

/**
 * Preserves the parent course identity a chapter result needs for navigation
 * while keeping the database relation itself inside core.
 */
function toChapterSearchResult(chapter: SearchChapter): ChapterSearchResult {
  return {
    brandSlug: chapter.course.organization.slug,
    courseId: chapter.course.id,
    courseSlug: chapter.course.slug,
    courseTitle: chapter.course.title,
    description: chapter.description,
    id: chapter.id,
    imageUrl: chapter.imageUrl,
    language: chapter.language,
    slug: chapter.slug,
    title: chapter.title,
  };
}

/**
 * Searches the published catalog as one capability so web and API consumers
 * share language scoping, result limits, and serialized course and chapter
 * shapes instead of composing separate repository reads in each delivery app.
 */
export async function searchCatalog({
  language,
  query,
}: {
  language: string;
  query: string;
}): Promise<CatalogSearchResults> {
  const searchParams = { filterByLanguage: true, language, query };

  const [courses, chapters] = await Promise.all([
    searchCourses(searchParams),
    searchChapters({ ...searchParams, limit: CATALOG_CHAPTER_SEARCH_LIMIT }),
  ]);

  return {
    chapters: chapters.map((chapter) => toChapterSearchResult(chapter)),
    courses: courses.map((course) => toCourseSearchResult(course)),
  };
}
