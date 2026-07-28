import { type searchCatalog } from "@zoonk/core/catalog/search";
import { type getChapterById } from "@zoonk/core/chapters/get-by-id";
import { type listCourseChapters } from "@zoonk/core/chapters/list-by-course";
import { type getCourseById } from "@zoonk/core/courses/get-by-id";
import { type listCompletedLanguageCourses } from "@zoonk/core/courses/language";
import { type listCourses } from "@zoonk/core/courses/list";
import { type getLessonById } from "@zoonk/core/lessons/get-by-id";
import { type listChapterLessons } from "@zoonk/core/lessons/list-by-chapter";

type CatalogSearch = Awaited<ReturnType<typeof searchCatalog>>;
type ChapterResource = NonNullable<Awaited<ReturnType<typeof getChapterById>>>;
type CourseChapter = Awaited<ReturnType<typeof listCourseChapters>>[number];
type CourseResource = NonNullable<Awaited<ReturnType<typeof getCourseById>>>;
type CourseSummary = Awaited<ReturnType<typeof listCourses>>[number];
type LanguageCourse = Awaited<ReturnType<typeof listCompletedLanguageCourses>>[number];
type LessonResource = NonNullable<Awaited<ReturnType<typeof getLessonById>>>;
type ChapterLesson = Awaited<ReturnType<typeof listChapterLessons>>[number];

/**
 * Serializes one organization into the stable public subset shared by course
 * list, detail, and current-library responses. Billing and auth-provider fields
 * remain internal even when Core loaded the complete relation.
 */
export function toOrganizationSummary(organization: CourseSummary["organization"]) {
  return {
    id: organization.id,
    logo: organization.logo,
    name: organization.name,
    slug: organization.slug,
  };
}

/**
 * Serializes the compact course shape used in paginated catalog collections.
 */
export function toCourseSummary(course: CourseSummary) {
  return {
    description: course.description,
    id: course.id,
    imageUrl: course.imageUrl,
    language: course.language,
    organization: toOrganizationSummary(course.organization),
    slug: course.slug,
    title: course.title,
  };
}

/**
 * Serializes the complete public course metadata resource while excluding
 * persistence-only fields and exposing only the first originating prompt ID.
 */
export function toCourseResource(course: CourseResource) {
  if (!course.organization) {
    throw new Error("Published brand course is missing its organization");
  }

  return {
    categories: course.categories.map((category) => category.category),
    coursePromptId: course.prompts.at(0)?.id ?? null,
    description: course.description,
    format: course.format,
    generationId: course.generationRunId,
    generationStatus: course.generationStatus,
    id: course.id,
    imageUrl: course.imageUrl,
    language: course.language,
    organization: toOrganizationSummary(course.organization),
    slug: course.slug,
    targetLanguage: course.targetLanguage,
    title: course.title,
  };
}

/**
 * Serializes a chapter returned inside a course collection and adds its
 * published lesson count without exposing Prisma's relation-count envelope.
 */
export function toCourseChapter(chapter: CourseChapter) {
  return {
    courseId: chapter.courseId,
    description: chapter.description,
    generationId: chapter.generationRunId,
    generationStatus: chapter.generationStatus,
    id: chapter.id,
    imageUrl: chapter.imageUrl,
    language: chapter.language,
    lessonCount: chapter._count.lessons,
    position: chapter.position,
    slug: chapter.slug,
    title: chapter.title,
  };
}

/**
 * Serializes the direct chapter resource and preserves its parent course ID.
 */
export function toChapterResource(chapter: ChapterResource) {
  return {
    courseId: chapter.courseId,
    description: chapter.description,
    generationId: chapter.generationRunId,
    generationStatus: chapter.generationStatus,
    id: chapter.id,
    imageUrl: chapter.imageUrl,
    language: chapter.language,
    position: chapter.position,
    slug: chapter.slug,
    title: chapter.title,
  };
}

/**
 * Serializes a lesson shell from a chapter collection. The caller supplies the
 * already-known course ID so no additional relation query is needed.
 */
export function toChapterLesson({ courseId, lesson }: { courseId: string; lesson: ChapterLesson }) {
  return {
    chapterId: lesson.chapterId,
    courseId,
    description: lesson.description,
    generationId: lesson.generationRunId,
    generationStatus: lesson.generationStatus,
    id: lesson.id,
    imageUrl: lesson.imageUrl,
    kind: lesson.kind,
    language: lesson.language,
    position: lesson.position,
    slug: lesson.slug,
    title: lesson.title,
  };
}

/**
 * Serializes the direct lesson shell with both parent resource IDs.
 */
export function toLessonResource(lesson: LessonResource) {
  return toChapterLesson({ courseId: lesson.chapter.courseId, lesson });
}

/**
 * Serializes the finite language-course picker resource without leaking the
 * nested Core tuple used to guarantee supported target-language values.
 */
export function toLanguageCourse({ course, targetLanguage }: LanguageCourse) {
  return {
    id: course.id,
    imageUrl: course.imageUrl,
    language: course.language,
    slug: course.slug,
    targetLanguage,
    title: course.title,
  };
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
      imageUrl: chapter.imageUrl,
      language: chapter.language,
      organizationSlug: chapter.brandSlug,
      slug: chapter.slug,
      title: chapter.title,
    })),
    courses: results.courses.map((course) => ({
      description: course.description,
      id: course.id,
      imageUrl: course.imageUrl,
      language: course.language,
      organizationSlug: course.brandSlug,
      slug: course.slug,
      title: course.title,
    })),
  };
}
