import { z } from "zod";
import { createDocument } from "zod-openapi";
import { paginationSchema } from "./schemas/common";
import { courseResultSchema, courseSearchQuerySchema } from "./schemas/courses";
import {
  validationErrorResponse,
  workflowStatusEndpoint,
  workflowTriggerEndpoint,
} from "./schemas/responses";
import {
  chapterGenerationTriggerSchema,
  courseGenerationTriggerSchema,
  lessonGenerationTriggerSchema,
} from "./schemas/workflows";

export const openAPIDocument = createDocument({
  info: {
    description: "API for the Zoonk learning platform",
    title: "Zoonk API",
    version: "1.0.0",
  },
  openapi: "3.1.0",
  paths: {
    "/auth/health": {
      get: {
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: z.object({ status: z.literal("ok") }),
              },
            },
            description: "Service is healthy",
          },
        },
        summary: "Health check",
        tags: ["Health"],
      },
    },
    "/courses/search": {
      get: {
        requestParams: { query: courseSearchQuerySchema },
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: z.object({
                  data: z.array(courseResultSchema),
                  pagination: paginationSchema,
                }),
              },
            },
            description: "Paginated course results",
          },
          "400": validationErrorResponse,
        },
        summary: "Search published courses",
        tags: ["Courses"],
      },
    },
    "/workflows/chapter-generation/status": workflowStatusEndpoint(
      "Stream chapter generation status (SSE)",
    ),
    "/workflows/chapter-generation/trigger": workflowTriggerEndpoint({
      requiresSubscription: true,
      schema: chapterGenerationTriggerSchema,
      summary: "Trigger chapter generation workflow",
    }),
    "/workflows/course-generation/status": workflowStatusEndpoint(
      "Stream course generation status (SSE)",
    ),
    "/workflows/course-generation/trigger": workflowTriggerEndpoint({
      schema: courseGenerationTriggerSchema,
      summary: "Trigger course generation workflow",
    }),
    "/workflows/lesson-generation/status": workflowStatusEndpoint(
      "Stream lesson generation status (SSE)",
    ),
    "/workflows/lesson-generation/trigger": workflowTriggerEndpoint({
      requiresSubscription: true,
      schema: lessonGenerationTriggerSchema,
      summary: "Trigger lesson generation workflow",
    }),
  },
  servers: [{ description: "API v1", url: "/v1" }],
});
