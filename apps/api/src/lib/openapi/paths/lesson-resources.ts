import {
  lessonCompletionRequestSchema,
  lessonCompletionResponseSchema,
  lessonContentResponseSchema,
  lessonPreloadResponseSchema,
  lessonSuccessorResponseSchema,
} from "../schemas/lesson-resources";
import { lessonPathParamsSchema } from "../schemas/paths";
import {
  forbiddenResponse,
  notFoundResponse,
  paymentRequiredResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY, OPTIONAL_AUTHENTICATION_SECURITY } from "../security";

export const lessonResourcePaths = {
  "/lessons/{lessonId}/completions": {
    post: {
      operationId: "createLessonCompletion",
      requestBody: {
        content: { "application/json": { schema: lessonCompletionRequestSchema } },
        required: true,
      },
      requestParams: { path: lessonPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: lessonCompletionResponseSchema } },
          description: "Authoritative completion rewards and progress",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "402": paymentRequiredResponse,
        "403": forbiddenResponse,
        "404": notFoundResponse,
        "422": unprocessableEntityResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Complete a lesson",
      tags: ["Progress"],
    },
  },
  "/lessons/{lessonId}/content": {
    get: {
      operationId: "getLessonContent",
      requestParams: { path: lessonPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: lessonContentResponseSchema } },
          description: "Playable lesson content or a generation outcome",
        },
        "400": validationErrorResponse,
        "402": paymentRequiredResponse,
        "404": notFoundResponse,
      },
      security: OPTIONAL_AUTHENTICATION_SECURITY,
      summary: "Get lesson content",
      tags: ["Lessons"],
    },
  },
  "/lessons/{lessonId}/next-lesson": {
    get: {
      operationId: "getLessonSuccessor",
      requestParams: { path: lessonPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: lessonSuccessorResponseSchema } },
          description: "The next published lesson in course order",
        },
        "400": validationErrorResponse,
        "404": notFoundResponse,
      },
      security: OPTIONAL_AUTHENTICATION_SECURITY,
      summary: "Get the next lesson after a lesson",
      tags: ["Lessons"],
    },
  },
  "/lessons/{lessonId}/preloads": {
    post: {
      description:
        "Derives a small generation lookahead from the current lesson. Clients cannot select workflow target IDs.",
      operationId: "createLessonPreload",
      requestParams: { path: lessonPathParamsSchema },
      responses: {
        "202": {
          content: { "application/json": { schema: lessonPreloadResponseSchema } },
          description: "Derived generation workflows accepted",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "403": forbiddenResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Preload upcoming lesson content",
      tags: ["Lessons"],
    },
  },
  "/lessons/{lessonId}/starts": {
    post: {
      operationId: "createLessonStart",
      requestParams: { path: lessonPathParamsSchema },
      responses: {
        "204": { description: "Lesson start recorded" },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "403": forbiddenResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Record a lesson start",
      tags: ["Progress"],
    },
  },
};
