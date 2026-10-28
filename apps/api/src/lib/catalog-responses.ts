import { type getCatalogChapter } from "@zoonk/core/catalog/chapter";
import { type listCatalogChapterLessons } from "@zoonk/core/catalog/chapter-lessons";
import { type listCatalogCourseChapters } from "@zoonk/core/catalog/course-chapters";
import { type searchCatalog } from "@zoonk/core/catalog/search";
import { type getCourseDetail } from "@zoonk/core/courses/get-detail";
import { parseCourseLandingPageContent } from "@zoonk/core/courses/landing-page";
import { type listCourses } from "@zoonk/core/courses/list";
import { getLanguageFlagCode } from "@zoonk/utils/language-flags";
import { toApiImageUrl } from "./file-urls";

type CatalogSearch = Awaited<ReturnType<typeof searchCatalog>>;
type CatalogChapter = NonNullable<Awaited<ReturnType<typeof getCatalogChapter>>>;
type CourseChapter = NonNullable<Awaited<ReturnType<typeof listCatalogCourseChapters>>>[number];
type ChapterLessons = NonNullable<Awaited<ReturnType<typeof listCatalogChapterLessons>>>;
type CourseResource = NonNullable<Awaited<ReturnType<typeof getCourseDetail>>>;
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

/** The flag a language course shows instead of its picture, as main's course mark draws it. */
function toLanguageFlag(targetLanguage: string | null) {
  return targetLanguage ? getLanguageFlagCode(targetLanguage) : null;
}

/**
 * A catalog course: its summary, what its outline holds (its lessons and their minutes), its
 * subject (the first category, which the list selects alone) and, for a language course, the
 * language it teaches and its flag.
 */
export function toCatalogCourse(course: CourseSummary) {
  return {
    ...toCourseSummary(course),
    estimatedMinutes: course.estimatedMinutes,
    languageFlag: toLanguageFlag(course.targetLanguage),
    lessonCount: course.lessonCount,
    subject: course.categories[0]?.category ?? null,
    targetLanguage: course.targetLanguage,
  };
}

/**
 * Serializes the complete course metadata resource while excluding
 * persistence-only fields. The generation fields follow the course outline,
 * which a course without one is still waiting for. Categories come oldest first,
 * so the first is the course's subject, as its pages color it; the landing copy
 * is null until the course's details are written.
 */
export function toCourseResource(course: CourseResource) {
  return {
    categories: course.categories
      .toSorted((one, other) => one.createdAt.getTime() - other.createdAt.getTime())
      .map((category) => category.category),
    description: course.description,
    exam: course.exam,
    examplePlan: course.examplePlan,
    format: course.format,
    generationId: course.outlineRunId,
    generationStatus: course.outlineStatus ?? "pending",
    id: course.id,
    imageUrl: course.imageUrl && toApiImageUrl(course.imageUrl),
    landingPage: parseCourseLandingPageContent(course.landingPage),
    language: course.language,
    languageFlag: toLanguageFlag(course.targetLanguage),
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
    objectives: chapter.objectives,
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
 * Serializes a chapter inside a course collection with its visible lessons'
 * outline (titles and minutes, as the course's page lists them) and their count.
 */
export function toCourseChapter(placement: CourseChapter) {
  const { lessons } = placement.chapter;

  return {
    ...toChapterResource(placement),
    lessonCount: lessons.length,
    lessons: lessons.map((lesson) => ({
      estimatedMinutes: lesson.estimatedMinutes,
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
    })),
  };
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
    estimatedMinutes: lesson.estimatedMinutes,
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
