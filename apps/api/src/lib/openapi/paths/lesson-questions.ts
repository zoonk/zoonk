import { MAX_LESSON_QUESTION_THREAD_TURNS } from "@zoonk/core/lesson-questions/contract";
import {
  createLessonQuestionRequestSchema,
  lessonQuestionAnswerStreamSchema,
  lessonQuestionResponseSchema,
  lessonQuestionThreadQuerySchema,
  lessonQuestionThreadResponseSchema,
} from "../schemas/lesson-questions";
import { lessonPathParamsSchema, lessonQuestionPathParamsSchema } from "../schemas/paths";
import {
  badRequestResponse,
  conflictResponse,
  forbiddenResponse,
  notFoundResponse,
  paymentRequiredResponse,
  tooManyRequestsResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

export const lessonQuestionPaths = {
  "/lessons/{lessonId}/questions": {
    get: {
      operationId: "getLessonQuestionThread",
      requestParams: { path: lessonPathParamsSchema, query: lessonQuestionThreadQuerySchema },
      responses: {
        "200": {
          content: { "application/json": { schema: lessonQuestionThreadResponseSchema } },
          description: `Up to ${MAX_LESSON_QUESTION_THREAD_TURNS} lesson questions ordered chronologically within the page; omitting the cursor returns the newest page, or null before the first question`,
        },
        "400": badRequestResponse,
        "401": unauthorizedResponse,
        "402": paymentRequiredResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get the current learner's lesson question thread",
      tags: ["Lessons"],
    },
    post: {
      operationId: "createLessonQuestion",
      requestBody: {
        content: { "application/json": { schema: createLessonQuestionRequestSchema } },
        required: true,
      },
      requestParams: { path: lessonPathParamsSchema },
      responses: {
        "201": {
          content: { "application/json": { schema: lessonQuestionResponseSchema } },
          description: "Durable pending lesson question",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "402": paymentRequiredResponse,
        "403": forbiddenResponse,
        "404": notFoundResponse,
        "409": conflictResponse,
        "422": unprocessableEntityResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Create a lesson question",
      tags: ["Lessons"],
    },
  },
  "/questions/{questionId}": {
    get: {
      operationId: "getLessonQuestion",
      requestParams: { path: lessonQuestionPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: lessonQuestionResponseSchema } },
          description: "Current learner-owned lesson question",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "402": paymentRequiredResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a lesson question",
      tags: ["Lessons"],
    },
  },
  "/questions/{questionId}/answers": {
    post: {
      description:
        "Claims a pending or failed question and returns one grounded answer as an AI SDK UI message stream.",
      operationId: "createLessonQuestionAnswer",
      requestParams: { path: lessonQuestionPathParamsSchema },
      responses: {
        "200": {
          content: { "text/event-stream": { schema: lessonQuestionAnswerStreamSchema } },
          description: "Lesson question answer streamed as AI SDK UI message events",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "402": paymentRequiredResponse,
        "403": forbiddenResponse,
        "404": notFoundResponse,
        "409": conflictResponse,
        "429": {
          ...tooManyRequestsResponse,
          description: "Lesson question generation quota reached",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Generate a lesson question answer",
      tags: ["Lessons"],
    },
  },
};
