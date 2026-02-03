import { z } from "zod";
import { createDocument } from "zod-openapi";
import { errorSchema, paginationSchema } from "./schemas/common";
import { courseResultSchema, courseSearchQuerySchema } from "./schemas/courses";
import {
  chapterGenerationTriggerSchema,
  courseGenerationTriggerSchema,
  workflowStatusQuerySchema,
  workflowTriggerResponseSchema,
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
          "400": {
            content: { "application/json": { schema: errorSchema } },
            description: "Validation error",
          },
        },
        summary: "Search published courses",
        tags: ["Courses"],
      },
    },
    "/workflows/chapter-generation/status": {
      get: {
        description: "Returns a Server-Sent Events stream with workflow status updates.",
        requestParams: { query: workflowStatusQuerySchema },
        responses: {
          "200": {
            content: { "text/event-stream": { schema: z.string() } },
            description: "SSE stream of workflow status",
          },
        },
        summary: "Stream chapter generation status (SSE)",
        tags: ["Workflows"],
      },
    },
    "/workflows/chapter-generation/trigger": {
      post: {
        description: "Requires active subscription.",
        requestBody: {
          content: { "application/json": { schema: chapterGenerationTriggerSchema } },
        },
        responses: {
          "200": {
            content: { "application/json": { schema: workflowTriggerResponseSchema } },
            description: "Workflow started",
          },
          "400": {
            content: { "application/json": { schema: errorSchema } },
            description: "Validation error",
          },
          "402": {
            content: { "application/json": { schema: errorSchema } },
            description: "Subscription required",
          },
        },
        summary: "Trigger chapter generation workflow",
        tags: ["Workflows"],
      },
    },
    "/workflows/course-generation/status": {
      get: {
        description: "Returns a Server-Sent Events stream with workflow status updates.",
        requestParams: { query: workflowStatusQuerySchema },
        responses: {
          "200": {
            content: { "text/event-stream": { schema: z.string() } },
            description: "SSE stream of workflow status",
          },
        },
        summary: "Stream course generation status (SSE)",
        tags: ["Workflows"],
      },
    },
    "/workflows/course-generation/trigger": {
      post: {
        requestBody: {
          content: { "application/json": { schema: courseGenerationTriggerSchema } },
        },
        responses: {
          "200": {
            content: { "application/json": { schema: workflowTriggerResponseSchema } },
            description: "Workflow started",
          },
          "400": {
            content: { "application/json": { schema: errorSchema } },
            description: "Validation error",
          },
        },
        summary: "Trigger course generation workflow",
        tags: ["Workflows"],
      },
    },
  },
  servers: [{ description: "API v1", url: "/v1" }],
});
