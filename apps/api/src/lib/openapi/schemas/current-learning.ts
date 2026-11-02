import { z } from "zod";
import { nullableOrganizationSummarySchema, resourcePageQuerySchema } from "./catalog-resources";
import { paginationSchema } from "./common";

export const currentUserCoursesQuerySchema = resourcePageQuerySchema
  .extend({
    query: z
      .string()
      .trim()
      .optional()
      .meta({ description: "Filter the courses by title or description, ignoring case" }),
  })
  .meta({ id: "CurrentUserCoursesQuery" });

const currentUserCourseSchema = z
  .object({
    description: z.string().nullable(),
    id: z.uuid(),
    imageUrl: z.string().nullable(),
    language: z.string(),
    organization: nullableOrganizationSummarySchema,
    slug: z.string(),
    title: z.string(),
  })
  .meta({ id: "CurrentUserCourse" });

export const currentUserCourseListResponseSchema = z
  .object({ data: z.array(currentUserCourseSchema), pagination: paginationSchema })
  .meta({ id: "CurrentUserCourseListResponse" });
