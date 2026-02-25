import { z } from "zod";

export const courseSearchQuerySchema = z
  .object({
    cursor: z.string().optional().meta({ description: "Pagination cursor" }),
    language: z
      .string()
      .min(2, "Language code must be at least 2 characters")
      .optional()
      .meta({ description: "Language code for sorting preference", example: "en" }),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(10)
      .meta({ description: "Results per page" }),
    query: z
      .string()
      .min(1, "Search query is required")
      .meta({ description: "Search query", example: "javascript" }),
  })
  .meta({ id: "CourseSearchQuery" });

const organizationSummarySchema = z
  .object({
    id: z.number().meta({ description: "Organization ID" }),
    logo: z.string().nullable().meta({ description: "Organization logo URL" }),
    name: z.string().meta({ description: "Organization name" }),
    slug: z.string().meta({ description: "Organization slug" }),
  })
  .meta({ id: "OrganizationSummary" });

export const courseResultSchema = z
  .object({
    description: z.string().nullable().meta({ description: "Course description" }),
    id: z.number().meta({ description: "Course ID" }),
    imageUrl: z.string().nullable().meta({ description: "Cover image URL" }),
    language: z.string().meta({ description: "Language code" }),
    organization: organizationSummarySchema,
    slug: z.string().meta({ description: "URL slug" }),
    title: z.string().meta({ description: "Course title" }),
  })
  .meta({ id: "CourseResult" });
