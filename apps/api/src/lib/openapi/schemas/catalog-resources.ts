import { CourseFormat, CourseLevel } from "@zoonk/db";
import { COURSE_CATEGORIES } from "@zoonk/utils/categories";
import { z } from "zod";

const generationStatusSchema = z.enum(["completed", "failed", "pending", "running"]);

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

export const chapterCourseContextQuerySchema = z
  .object({
    courseId: z
      .uuid()
      .optional()
      .meta({
        description:
          "Course to read the chapter in, since a chapter can be placed in several courses. Defaults to the chapter's home course; a course that doesn't place the chapter is not found.",
      }),
  })
  .meta({ id: "ChapterCourseContextQuery" });

export const organizationSummarySchema = z
  .object({
    id: z.uuid().meta({ description: "Organization ID" }),
    logo: z.string().nullable().meta({ description: "Organization logo URL" }),
    name: z.string().meta({ description: "Organization name" }),
    slug: z.string().meta({ description: "Organization slug" }),
  })
  .meta({ id: "OrganizationSummary" });

export const nullableOrganizationSummarySchema = organizationSummarySchema
  .nullable()
  .meta({
    description: "Null for a learner's private course, which has no organization or public page",
  });

export const courseResourceSchema = z
  .object({
    categories: z.array(z.enum(COURSE_CATEGORIES)),
    description: z.string().nullable(),
    format: z.enum(CourseFormat),
    generationId: z
      .string()
      .nullable()
      .meta({ description: "Run writing the course outline, followed through generations" }),
    generationStatus: generationStatusSchema.meta({
      description: "Whether every chapter of the course outline is written",
    }),
    id: z.uuid(),
    imageUrl: z.string().nullable(),
    language: z.string(),
    organization: nullableOrganizationSummarySchema,
    slug: z.string(),
    targetLanguage: z.string().nullable(),
    title: z.string(),
  })
  .meta({ id: "CourseResource" });

export const chapterResourceSchema = z
  .object({
    courseId: z.uuid().meta({ description: "Course the chapter is read in" }),
    description: z.string(),
    generationId: z
      .string()
      .nullable()
      .meta({ description: "Run writing the chapter's lesson outline" }),
    generationStatus: generationStatusSchema.meta({
      description: "Whether the chapter's lesson titles and descriptions are written",
    }),
    id: z.uuid(),
    language: z.string(),
    level: z.enum(CourseLevel).meta({ description: "Level band the course places the chapter in" }),
    position: z
      .number()
      .int()
      .min(0)
      .meta({ description: "0-based position across the whole course outline" }),
    slug: z.string(),
    title: z.string(),
  })
  .meta({ id: "ChapterResource" });

const courseChapterSchema = chapterResourceSchema
  .extend({ lessonCount: z.number().int().min(0) })
  .meta({ id: "CourseChapter" });

const lessonResourceSchema = z
  .object({
    chapterId: z.uuid(),
    courseId: z.uuid(),
    description: z.string().nullable(),
    generationId: z.string().nullable().meta({ description: "Run writing the lesson's content" }),
    generationStatus: generationStatusSchema.meta({
      description: "Whether the lesson's content is written",
    }),
    id: z.uuid(),
    language: z.string(),
    position: z.number().int().min(0).meta({ description: "0-based position in the chapter" }),
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
        targetLanguage: z
          .string()
          .nullable()
          .meta({ description: "The language a language course teaches; null for other courses" }),
        title: z.string(),
      }),
    ),
  })
  .meta({ id: "CatalogSearchResponse" });

export const courseChapterListResponseSchema = z
  .object({ data: z.array(courseChapterSchema) })
  .meta({ id: "CourseChapterListResponse" });

export const chapterLessonListResponseSchema = z
  .object({ data: z.array(lessonResourceSchema) })
  .meta({ id: "ChapterLessonListResponse" });
