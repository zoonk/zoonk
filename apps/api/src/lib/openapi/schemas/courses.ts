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
    id: z.uuid().meta({ description: "Course ID" }),
    imageUrl: z.string().nullable().meta({ description: "Cover image URL" }),
    language: z.string().meta({ description: "Language code" }),
    organization: organizationSummarySchema,
    slug: z.string().meta({ description: "URL slug" }),
    title: z.string().meta({ description: "Course title" }),
  })
  .meta({ id: "CourseResult" });
