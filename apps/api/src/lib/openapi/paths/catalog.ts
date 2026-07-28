import { z } from "zod";
import { paginationSchema } from "../schemas/common";
import { courseListQuerySchema, courseResultSchema } from "../schemas/courses";
import { badRequestResponse } from "../schemas/responses";
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
