import "server-only";
import { searchCourses } from "../courses/search-courses";
import { searchLibraryChapters } from "./_utils/search-library-chapters";

const CATALOG_CHAPTER_SEARCH_LIMIT = 5;

type SearchChapter = Awaited<ReturnType<typeof searchLibraryChapters>>[number];
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
  /** The language a language course teaches, which shows its flag; null for other courses. */
  targetLanguage: string | null;
  title: string;
};

export type ChapterSearchResult = {
  brandSlug: string;
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  description: string;
  id: string;
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
    targetLanguage: course.targetLanguage,
    title: course.title,
  };
}

/**
 * A chapter result links to its home course's page, so it carries that course and its brand.
 * The search only matches chapters whose home course is a published brand course.
 */
function toChapterSearchResult({ homeCourse, ...chapter }: SearchChapter): ChapterSearchResult[] {
  if (!homeCourse?.organization) {
    return [];
  }

  return [
    {
      brandSlug: homeCourse.organization.slug,
      courseId: homeCourse.id,
      courseSlug: homeCourse.slug,
      courseTitle: homeCourse.title,
      description: chapter.description,
      id: chapter.id,
      language: chapter.language,
      slug: chapter.slug,
      title: chapter.title,
    },
  ];
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
  const [courses, chapters] = await Promise.all([
    searchCourses({ filterByLanguage: true, language, query }),
    searchLibraryChapters({ language, limit: CATALOG_CHAPTER_SEARCH_LIMIT, query }),
  ]);

  return {
    chapters: chapters.flatMap((chapter) => toChapterSearchResult(chapter)),
    courses: courses.map((course) => toCourseSearchResult(course)),
  };
}
