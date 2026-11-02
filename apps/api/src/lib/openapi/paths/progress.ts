import { chapterCourseContextQuerySchema } from "../schemas/catalog-resources";
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
      description:
        "The first lesson the learner hasn't finished in the chapter, read in its home course unless `courseId` names another course that places it. When every lesson is finished, the first lesson with `completed` true; `empty` while the chapter's lessons aren't written yet.",
      operationId: "getChapterNextLesson",
      requestParams: { path: chapterPathParamsSchema, query: chapterCourseContextQuerySchema },
      responses: nextLessonResponses,
      security: OPTIONAL_AUTHENTICATION_SECURITY,
      summary: "Get the next lesson in a chapter",
      tags: ["Progress"],
    },
  },
  "/chapters/{chapterId}/progress": {
    get: {
      description:
        "The lessons the learner finished in the chapter. A chapter's progress is the same in every course that places it. Empty without a session.",
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
      description:
        "The first lesson the learner hasn't finished in the course's reading order. A `chapter` target when the next chapter's lessons aren't written yet; the first lesson with `completed` true when every lesson is finished; `empty` for a course without chapters. Without a session, the first lesson.",
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
      description:
        "The lessons the learner finished per chapter, in reading order, and the course percentage (estimated while some chapters' lessons aren't written). Empty without a session.",
      operationId: "getCourseProgress",
      requestParams: { path: coursePathParamsSchema },
      responses: courseProgressResponses,
      security: OPTIONAL_AUTHENTICATION_SECURITY,
      summary: "Get progress for a course",
      tags: ["Progress"],
    },
  },
};
