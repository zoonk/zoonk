import {
  courseEstimateQuerySchema,
  courseEstimateResponseSchema,
} from "../schemas/course-estimates";
import { coursePathParamsSchema } from "../schemas/paths";
import { validationErrorResponse } from "../schemas/responses";
import { PUBLIC_SECURITY } from "../security";

export const courseEstimatePaths = {
  "/courses/{courseId}/estimate": {
    get: {
      description:
        "Plans the published public outline from scratch, at the visitor's pace, without AI or writes. Without a date, returns weeks, end date, the first day's lessons and chapter weeks only when the whole outline fits. With a date, returns fitting original lesson counts by area and chapter, in study order; zero lessons marks a chapter's original lessons left out. Area totals include all public outline lessons, even those the exam planner excludes. Supplementary quick lessons do not increase original lesson counts. Returns null for private, unpublished, missing or outline-free courses, or an undated pace that the planner cannot complete. The calendar starts on the current UTC day; personalized plans can differ with timezone, level, placement and progress.",
      operationId: "estimateCoursePlan",
      requestParams: { path: coursePathParamsSchema, query: courseEstimateQuerySchema },
      responses: {
        "200": {
          content: { "application/json": { schema: courseEstimateResponseSchema } },
          description: "The course plan estimate, or null when no public outline is estimable",
        },
        "400": validationErrorResponse,
      },
      security: PUBLIC_SECURITY,
      summary: "Estimate a course plan",
      tags: ["Courses"],
    },
  },
};
