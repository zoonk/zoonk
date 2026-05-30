import { z } from "zod";
import { createDocument } from "zod-openapi";
import { paginationSchema } from "./schemas/common";
import { courseResultSchema, courseSearchQuerySchema } from "./schemas/courses";
import { feedbackResponseSchema, feedbackSubmissionSchema } from "./schemas/feedback";
import { meResponseSchema, meUpdateSchema } from "./schemas/me";
import {
  chapterCompletionQuerySchema,
  chapterCompletionResponseSchema,
  courseCompletionQuerySchema,
  courseCompletionResponseSchema,
  nextLessonQuerySchema,
  nextLessonResponseSchema,
} from "./schemas/progress";
import {
  badRequestResponse,
  conflictResponse,
  unauthorizedResponse,
  validationErrorResponse,
  workflowStatusEndpoint,
  workflowTriggerEndpoint,
} from "./schemas/responses";
import {
  chapterGenerationTriggerSchema,
  courseGenerationTriggerSchema,
  lessonGenerationTriggerSchema,
  lessonPreloadTriggerSchema,
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
            content: { "application/json": { schema: z.object({ status: z.literal("ok") }) } },
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
    "/feedback": {
      post: {
        requestBody: { content: { "application/json": { schema: feedbackSubmissionSchema } } },
        responses: {
          "200": {
            content: { "application/json": { schema: feedbackResponseSchema } },
            description: "Feedback received",
          },
          "400": validationErrorResponse,
        },
        summary: "Submit a feedback message",
        tags: ["Feedback"],
      },
    },
    "/me": {
      get: {
        responses: {
          "200": {
            content: { "application/json": { schema: meResponseSchema } },
            description: "Current user and account state",
          },
          "401": unauthorizedResponse,
        },
        summary: "Get current user",
        tags: ["Auth"],
      },
      patch: {
        requestBody: { content: { "application/json": { schema: meUpdateSchema } } },
        responses: {
          "200": {
            content: { "application/json": { schema: meResponseSchema } },
            description: "Updated user and account state",
          },
          "400": badRequestResponse,
          "401": unauthorizedResponse,
          "409": conflictResponse,
        },
        summary: "Update current user",
        tags: ["Auth"],
      },
    },
    "/progress/chapter-completion": {
      get: {
        requestParams: { query: chapterCompletionQuerySchema },
        responses: {
          "200": {
            content: { "application/json": { schema: chapterCompletionResponseSchema } },
            description: "Lesson completion status for a chapter",
          },
          "400": validationErrorResponse,
        },
        summary: "Get lesson completion for a chapter",
        tags: ["Progress"],
      },
    },
    "/progress/course-completion": {
      get: {
        requestParams: { query: courseCompletionQuerySchema },
        responses: {
          "200": {
            content: { "application/json": { schema: courseCompletionResponseSchema } },
            description: "Chapter completion status for a course",
          },
          "400": validationErrorResponse,
        },
        summary: "Get chapter completion for a course",
        tags: ["Progress"],
      },
    },
    "/progress/next-lesson": {
      get: {
        requestParams: { query: nextLessonQuerySchema },
        responses: {
          "200": {
            content: { "application/json": { schema: nextLessonResponseSchema } },
            description: "Next lesson to complete",
          },
          "400": validationErrorResponse,
        },
        summary: "Get next lesson for a course, chapter, or lesson",
        tags: ["Progress"],
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
      mayRequireAuthentication: true,
      requiresSubscription: true,
      schema: lessonGenerationTriggerSchema,
      summary: "Trigger lesson generation workflow",
    }),
    "/workflows/lesson-preload/trigger": workflowTriggerEndpoint({
      mayRequireAuthentication: true,
      requiresSubscription: true,
      schema: lessonPreloadTriggerSchema,
      summary: "Trigger lesson preload workflow",
    }),
  },
  servers: [{ description: "API v1", url: "/v1" }],
});
