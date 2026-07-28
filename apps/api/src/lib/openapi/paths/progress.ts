import { chapterPathParamsSchema, coursePathParamsSchema } from "../schemas/paths";
import {
  chapterCompletionResponseSchema,
  courseCompletionResponseSchema,
  nextLessonResponseSchema,
} from "../schemas/progress";
import { notFoundResponse, validationErrorResponse } from "../schemas/responses";
import { OPTIONAL_AUTHENTICATION_SECURITY } from "../security";

const chapterProgressResponses = {
  "200": {
    content: { "application/json": { schema: chapterCompletionResponseSchema } },
    description: "Lesson completion status for a chapter",
  },
  "400": validationErrorResponse,
  "404": notFoundResponse,
};

const courseProgressResponses = {
  "200": {
    content: { "application/json": { schema: courseCompletionResponseSchema } },
    description: "Chapter completion status for a course",
  },
  "400": validationErrorResponse,
  "404": notFoundResponse,
};

const nextLessonResponses = {
  "200": {
    content: { "application/json": { schema: nextLessonResponseSchema } },
    description: "Next lesson to complete",
  },
  "400": validationErrorResponse,
  "404": notFoundResponse,
};

export const progressPaths = {
  "/chapters/{chapterId}/next-lesson": {
    get: {
      operationId: "getChapterNextLesson",
      requestParams: { path: chapterPathParamsSchema },
      responses: nextLessonResponses,
      security: OPTIONAL_AUTHENTICATION_SECURITY,
      summary: "Get the next lesson in a chapter",
      tags: ["Progress"],
    },
  },
  "/chapters/{chapterId}/progress": {
    get: {
      operationId: "getChapterProgress",
      requestParams: { path: chapterPathParamsSchema },
      responses: chapterProgressResponses,
      security: OPTIONAL_AUTHENTICATION_SECURITY,
      summary: "Get progress for a chapter",
      tags: ["Progress"],
    },
  },
  "/courses/{courseId}/next-lesson": {
    get: {
      operationId: "getCourseNextLesson",
      requestParams: { path: coursePathParamsSchema },
      responses: nextLessonResponses,
      security: OPTIONAL_AUTHENTICATION_SECURITY,
      summary: "Get the next lesson in a course",
      tags: ["Progress"],
    },
  },
  "/courses/{courseId}/progress": {
    get: {
      operationId: "getCourseProgress",
      requestParams: { path: coursePathParamsSchema },
      responses: courseProgressResponses,
      security: OPTIONAL_AUTHENTICATION_SECURITY,
      summary: "Get progress for a course",
      tags: ["Progress"],
    },
  },
};
