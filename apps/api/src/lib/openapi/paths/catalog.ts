import { z } from "zod";
import { paginationSchema } from "../schemas/common";
import {
  courseCategoryCountsQuerySchema,
  courseCategoryCountsSchema,
  courseListQuerySchema,
  courseResultSchema,
} from "../schemas/courses";
import { badRequestResponse, validationErrorResponse } from "../schemas/responses";
import { PUBLIC_SECURITY } from "../security";

const courseSearchResponseSchema = z.object({
  data: z.array(courseResultSchema),
  pagination: paginationSchema,
});

const courseSearchResponses = {
  "200": {
    content: { "application/json": { schema: courseSearchResponseSchema } },
    description: "Paginated course results",
  },
  "400": badRequestResponse,
};

export const catalogPaths = {
  "/catalog/categories": {
    get: {
      operationId: "listCourseCategoryCounts",
      requestParams: { query: courseCategoryCountsQuerySchema },
      responses: {
        "200": {
          content: { "application/json": { schema: courseCategoryCountsSchema } },
          description: "Listed courses in all and per category",
        },
        "400": validationErrorResponse,
      },
      security: PUBLIC_SECURITY,
      summary: "Count published courses per category",
      tags: ["Courses"],
    },
  },
  "/courses": {
    get: {
      operationId: "listCourses",
      requestParams: { query: courseListQuerySchema },
      responses: courseSearchResponses,
      security: PUBLIC_SECURITY,
      summary: "List published courses",
      tags: ["Courses"],
    },
  },
};
