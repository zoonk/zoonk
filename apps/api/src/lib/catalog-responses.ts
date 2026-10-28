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

type ChapterFields = CatalogChapter["chapter"] | CourseChapter["chapter"];

/** Billing and auth-provider fields stay internal even when Core loaded the whole relation. */
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

function toLanguageFlag(targetLanguage: string | null) {
  return targetLanguage ? getLanguageFlagCode(targetLanguage) : null;
}

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

export function toCourseResource(course: CourseResource) {
  return {
    categories: course.categories
      .toSorted((one, other) => one.createdAt.getTime() - other.createdAt.getTime())
      .map((category) => category.category),
    description: course.description,
    editions: course.editions.map(({ id, language, title }) => ({ id, language, title })),
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

export function toChapterResource({
  chapter,
  courseId,
  level,
  position,
}: Omit<CatalogChapter, "chapter"> & { chapter: ChapterFields }) {
  return { ...toChapterFields(chapter), courseId, level, position };
}

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
