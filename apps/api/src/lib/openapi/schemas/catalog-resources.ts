import { COURSE_CATEGORIES } from "@zoonk/utils/categories";
import { TTS_SUPPORTED_LANGUAGE_CODES } from "@zoonk/utils/languages";
import { z } from "zod";
import { courseFormatSchema, generationStatusSchema, lessonKindSchema } from "./curriculum";

const DEFAULT_RESOURCE_PAGE_SIZE = 20;

export const resourcePageQuerySchema = z
  .object({
    cursor: z.string().optional().meta({ description: "Pagination cursor" }),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(DEFAULT_RESOURCE_PAGE_SIZE)
      .meta({ description: "Results per page" }),
  })
  .meta({ id: "ResourcePageQuery" });

export const catalogSearchQuerySchema = z
  .object({
    language: z
      .string()
      .min(2)
      .meta({ description: "Catalog language code", examples: ["en"] }),
    query: z.string().trim().min(1).meta({ description: "Search query" }),
  })
  .meta({ id: "CatalogSearchQuery" });

export const languageCourseQuerySchema = z
  .object({
    language: z
      .string()
      .min(2)
      .meta({ description: "Learner language code", examples: ["en"] }),
  })
  .meta({ id: "LanguageCourseQuery" });

export const organizationSummarySchema = z
  .object({
    id: z.uuid().meta({ description: "Organization ID" }),
    logo: z.string().nullable().meta({ description: "Organization logo URL" }),
    name: z.string().meta({ description: "Organization name" }),
    slug: z.string().meta({ description: "Organization slug" }),
  })
  .meta({ id: "OrganizationSummary" });

export const courseResourceSchema = z
  .object({
    categories: z.array(z.enum(COURSE_CATEGORIES)),
    coursePromptId: z.uuid().nullable(),
    description: z.string().nullable(),
    format: courseFormatSchema,
    generationId: z.string().nullable(),
    generationStatus: generationStatusSchema,
    id: z.uuid(),
    imageUrl: z.string().nullable(),
    language: z.string(),
    organization: organizationSummarySchema,
    slug: z.string(),
    targetLanguage: z.string().nullable(),
    title: z.string(),
  })
  .meta({ id: "CourseResource" });

export const chapterResourceSchema = z
  .object({
    courseId: z.uuid(),
    description: z.string(),
    generationId: z.string().nullable(),
    generationStatus: generationStatusSchema,
    id: z.uuid(),
    imageUrl: z.string().nullable(),
    language: z.string(),
    position: z.number().int().min(0),
    slug: z.string(),
    title: z.string(),
  })
  .meta({ id: "ChapterResource" });

const courseChapterSchema = chapterResourceSchema
  .extend({ lessonCount: z.number().int().min(0) })
  .meta({ id: "CourseChapter" });

export const lessonResourceSchema = z
  .object({
    chapterId: z.uuid(),
    courseId: z.uuid(),
    description: z.string().nullable(),
    generationId: z.string().nullable(),
    generationStatus: generationStatusSchema,
    id: z.uuid(),
    imageUrl: z.string().nullable(),
    kind: lessonKindSchema,
    language: z.string(),
    position: z.number().int().min(0),
    slug: z.string(),
    title: z.string().nullable(),
  })
  .meta({ id: "LessonResource" });

export const catalogSearchResponseSchema = z
  .object({
    chapters: z.array(
      z.object({
        courseId: z.uuid(),
        courseSlug: z.string(),
        courseTitle: z.string(),
        description: z.string(),
        id: z.uuid(),
        imageUrl: z.string().nullable(),
        language: z.string(),
        organizationSlug: z.string(),
        slug: z.string(),
        title: z.string(),
      }),
    ),
    courses: z.array(
      z.object({
        description: z.string().nullable(),
        id: z.uuid(),
        imageUrl: z.string().nullable(),
        language: z.string(),
        organizationSlug: z.string(),
        slug: z.string(),
        title: z.string(),
      }),
    ),
  })
  .meta({ id: "CatalogSearchResponse" });

const languageCourseSchema = z
  .object({
    id: z.uuid(),
    imageUrl: z.string().nullable(),
    language: z.string(),
    slug: z.string(),
    targetLanguage: z.enum(TTS_SUPPORTED_LANGUAGE_CODES),
    title: z.string(),
  })
  .meta({ id: "LanguageCourse" });

export const languageCourseListResponseSchema = z
  .object({ data: z.array(languageCourseSchema) })
  .meta({ id: "LanguageCourseListResponse" });

export const courseChapterListResponseSchema = z
  .object({ data: z.array(courseChapterSchema) })
  .meta({ id: "CourseChapterListResponse" });

export const chapterLessonListResponseSchema = z
  .object({ data: z.array(lessonResourceSchema) })
  .meta({ id: "ChapterLessonListResponse" });
