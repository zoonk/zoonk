import { type getCatalogChapter } from "@zoonk/core/catalog/chapter";
import { type listCatalogChapterLessons } from "@zoonk/core/catalog/chapter-lessons";
import { type listCatalogCourseChapters } from "@zoonk/core/catalog/course-chapters";
import { type searchCatalog } from "@zoonk/core/catalog/search";
import { type getCourseById } from "@zoonk/core/courses/get-by-id";
import { type listCourses } from "@zoonk/core/courses/list";
import { toApiImageUrl } from "./file-urls";

type CatalogSearch = Awaited<ReturnType<typeof searchCatalog>>;
type CatalogChapter = NonNullable<Awaited<ReturnType<typeof getCatalogChapter>>>;
type CourseChapter = NonNullable<Awaited<ReturnType<typeof listCatalogCourseChapters>>>[number];
type ChapterLessons = NonNullable<Awaited<ReturnType<typeof listCatalogChapterLessons>>>;
type CourseResource = NonNullable<Awaited<ReturnType<typeof getCourseById>>>;
type CourseSummary = Awaited<ReturnType<typeof listCourses>>[number];

/** The Library chapter fields both chapter resources share. */
type ChapterFields = CatalogChapter["chapter"] | CourseChapter["chapter"];

/**
 * Serializes one organization into the stable public subset shared by course
 * list, detail, and current-library responses. Billing and auth-provider fields
 * remain internal even when Core loaded the complete relation. A learner's
 * private course has no organization, so the relationship stays nullable
 * instead of inventing a synthetic brand.
 */
function toCourseOrganization(organization: CourseSummary["organization"] | null) {
  if (!organization) {
    return null;
  }

  return {
    id: organization.id,
    logo: organization.logo && toApiImageUrl(organization.logo),
    name: organization.name,
    slug: organization.slug,
  };
}

/** Serializes the compact course shape of course lists: the catalog's and the learner's own. */
export function toCourseSummary(
  course: Pick<CourseSummary, "description" | "id" | "imageUrl" | "language" | "slug" | "title"> & {
    organization: CourseSummary["organization"] | null;
  },
) {
  return {
    description: course.description,
    id: course.id,
    imageUrl: course.imageUrl && toApiImageUrl(course.imageUrl),
    language: course.language,
    organization: toCourseOrganization(course.organization),
    slug: course.slug,
    title: course.title,
  };
}

/**
 * Serializes the complete course metadata resource while excluding
 * persistence-only fields. The generation fields follow the course outline,
 * which a course without one is still waiting for.
 */
export function toCourseResource(course: CourseResource) {
  return {
    categories: course.categories.map((category) => category.category),
    description: course.description,
    format: course.format,
    generationId: course.outlineRunId,
    generationStatus: course.outlineStatus ?? "pending",
    id: course.id,
    imageUrl: course.imageUrl && toApiImageUrl(course.imageUrl),
    language: course.language,
    organization: toCourseOrganization(course.organization),
    slug: course.slug,
    targetLanguage: course.targetLanguage,
    title: course.title,
  };
}

/**
 * A chapter's generation fields follow its lesson outline: the titles and
 * descriptions of its lessons.
 */
function toChapterFields(chapter: ChapterFields) {
  return {
    description: chapter.description,
    generationId: chapter.outlineRunId,
    generationStatus: chapter.outlineStatus,
    id: chapter.id,
    language: chapter.language,
    slug: chapter.slug,
    title: chapter.title,
  };
}

/**
 * Serializes a chapter as its course places it: the course it's read in, its
 * level band and its position across that course's outline.
 */
export function toChapterResource({
  chapter,
  courseId,
  level,
  position,
}: Omit<CatalogChapter, "chapter"> & { chapter: ChapterFields }) {
  return { ...toChapterFields(chapter), courseId, level, position };
}

/**
 * Serializes a chapter inside a course collection with its visible lesson
 * count.
 */
export function toCourseChapter(placement: CourseChapter) {
  return { ...toChapterResource(placement), lessonCount: placement.chapter.lessons.length };
}

/**
 * Serializes a chapter's lessons with the chapter and the course they're read
 * in. A lesson's generation fields follow its content.
 */
export function toChapterLessons({ chapterId, courseId, lessons }: ChapterLessons) {
  return lessons.map((lesson) => ({
    chapterId,
    courseId,
    description: lesson.description,
    generationId: lesson.contentRunId,
    generationStatus: lesson.contentStatus,
    id: lesson.id,
    language: lesson.language,
    position: lesson.position,
    slug: lesson.slug,
    title: lesson.title,
  }));
}

/**
 * Renames Core's route-neutral brand identity to the organization terminology
 * used by the public API while preserving the two bounded search collections.
 */
export function toCatalogSearchResponse(results: CatalogSearch) {
  return {
    chapters: results.chapters.map((chapter) => ({
      courseId: chapter.courseId,
      courseSlug: chapter.courseSlug,
      courseTitle: chapter.courseTitle,
      description: chapter.description,
      id: chapter.id,
      language: chapter.language,
      organizationSlug: chapter.brandSlug,
      slug: chapter.slug,
      title: chapter.title,
    })),
    courses: results.courses.map((course) => ({
      description: course.description,
      id: course.id,
      imageUrl: course.imageUrl && toApiImageUrl(course.imageUrl),
      language: course.language,
      organizationSlug: course.brandSlug,
      slug: course.slug,
      targetLanguage: course.targetLanguage,
      title: course.title,
    })),
  };
}
