import { COURSE_CATEGORIES } from "@zoonk/utils/categories";
import { z } from "zod";
import { organizationSummarySchema } from "./catalog-resources";

export const courseListQuerySchema = z
  .object({
    category: z.enum(COURSE_CATEGORIES).optional().meta({ description: "Course category filter" }),
    cursor: z.string().optional().meta({ description: "Pagination cursor" }),
    language: z
      .string()
      .min(2, "Language code must be at least 2 characters")
      .meta({ description: "Course language code", examples: ["en"] }),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(10)
      .meta({ description: "Results per page" }),
  })
  .strict()
  .meta({ id: "CourseListQuery" });

export const courseResultSchema = z
  .object({
    description: z.string().nullable().meta({ description: "Course description" }),
    estimatedMinutes: z
      .int()
      .nonnegative()
      .meta({
        description:
          "The estimated minutes of every lesson in the course's outline added up, as its page states its length",
      }),
    id: z.uuid().meta({ description: "Course ID" }),
    imageUrl: z.string().nullable().meta({ description: "Cover image URL" }),
    language: z.string().meta({ description: "Language code" }),
    languageFlag: z
      .string()
      .nullable()
      .meta({
        description:
          "A language course's flag: a country's two-letter code, or a region's (`es-ct`, `gb-wls`, `arab`), as flag-icons names them; null for other courses",
      }),
    lessonCount: z
      .int()
      .nonnegative()
      .meta({
        description: "Lessons in the course's outline; 0 while its lessons aren't written yet",
      }),
    organization: organizationSummarySchema,
    slug: z.string().meta({ description: "URL slug" }),
    subject: z
      .enum(COURSE_CATEGORIES)
      .nullable()
      .meta({
        description:
          "The course's first category, which its pages take their color from; null for a course in none",
      }),
    targetLanguage: z
      .string()
      .nullable()
      .meta({ description: "The language a language course teaches; null for other courses" }),
    title: z.string().meta({ description: "Course title" }),
  })
  .meta({ id: "CourseResult" });

export const courseCategoryCountsQuerySchema = z
  .object({
    language: z
      .string()
      .min(2, "Language code must be at least 2 characters")
      .meta({ description: "Course language code", examples: ["en"] }),
  })
  .strict()
  .meta({ id: "CourseCategoryCountsQuery" });

export const courseCategoryCountsSchema = z
  .object({
    categories: z
      .array(z.object({ category: z.enum(COURSE_CATEGORIES), courseCount: z.int().nonnegative() }))
      .meta({ description: "Every category, with how many listed courses it has" }),
    total: z
      .int()
      .nonnegative()
      .meta({
        description:
          "Listed courses in the language; a course can sit in several categories, so it isn't their sum",
      }),
  })
  .meta({ id: "CourseCategoryCounts" });
