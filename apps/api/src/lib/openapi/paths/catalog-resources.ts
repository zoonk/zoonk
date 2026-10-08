import {
  catalogSearchQuerySchema,
  catalogSearchResponseSchema,
  chapterCourseContextQuerySchema,
  chapterLessonListResponseSchema,
  chapterResourceSchema,
  courseChapterListResponseSchema,
  courseResourceSchema,
} from "../schemas/catalog-resources";
import { chapterPathParamsSchema, coursePathParamsSchema } from "../schemas/paths";
import { notFoundResponse, validationErrorResponse } from "../schemas/responses";
import { OPTIONAL_AUTHENTICATION_SECURITY, PUBLIC_SECURITY } from "../security";

const resourceNotFoundResponses = { "400": validationErrorResponse, "404": notFoundResponse };

const PRIVATE_CHAPTER_ACCESS =
  "A chapter read in a learner's private course is only found with that learner's session.";

export const catalogResourcePaths = {
  "/catalog/search": {
    get: {
      operationId: "searchCatalog",
      requestParams: { query: catalogSearchQuerySchema },
      responses: {
        "200": {
          content: { "application/json": { schema: catalogSearchResponseSchema } },
          description: "Bounded matching course and chapter resources",
        },
        "400": validationErrorResponse,
      },
      security: PUBLIC_SECURITY,
      summary: "Search the catalog",
      tags: ["Courses"],
    },
  },
  "/chapters/{chapterId}": {
    get: {
      description: `A chapter as one course places it: its level band and position in that course's outline. Reads the chapter in its home course unless \`courseId\` names another course that places it. ${PRIVATE_CHAPTER_ACCESS}`,
      operationId: "getChapter",
      requestParams: { path: chapterPathParamsSchema, query: chapterCourseContextQuerySchema },
      responses: {
        "200": {
          content: { "application/json": { schema: chapterResourceSchema } },
          description: "Chapter metadata in the course",
        },
        ...resourceNotFoundResponses,
      },
      security: OPTIONAL_AUTHENTICATION_SECURITY,
      summary: "Get a chapter",
      tags: ["Chapters"],
    },
  },
  "/chapters/{chapterId}/lessons": {
    get: {
      description: `Every lesson of the chapter in order, read in its home course unless \`courseId\` names another course that places it. ${PRIVATE_CHAPTER_ACCESS}`,
      operationId: "listChapterLessons",
      requestParams: { path: chapterPathParamsSchema, query: chapterCourseContextQuerySchema },
      responses: {
        "200": {
          content: { "application/json": { schema: chapterLessonListResponseSchema } },
          description: "Every lesson of the chapter in order",
        },
        ...resourceNotFoundResponses,
      },
      security: OPTIONAL_AUTHENTICATION_SECURITY,
      summary: "List chapter lessons",
      tags: ["Lessons"],
    },
  },
  "/courses/{courseId}": {
    get: {
      description:
        "A published brand course, or the signed-in learner's own private course, whose `organization` is null. Another learner's private course is not found.",
      operationId: "getCourse",
      requestParams: { path: coursePathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: courseResourceSchema } },
          description: "Course metadata",
        },
        ...resourceNotFoundResponses,
      },
      security: OPTIONAL_AUTHENTICATION_SECURITY,
      summary: "Get a course",
      tags: ["Courses"],
    },
  },
  "/courses/{courseId}/chapters": {
    get: {
      description:
        "Every chapter of a published brand course, or of the signed-in learner's own private course. Another learner's private course is not found.",
      operationId: "listCourseChapters",
      requestParams: { path: coursePathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: courseChapterListResponseSchema } },
          description: "Every chapter of the course in reading order, from overview to advanced",
        },
        ...resourceNotFoundResponses,
      },
      security: OPTIONAL_AUTHENTICATION_SECURITY,
      summary: "List course chapters",
      tags: ["Chapters"],
    },
  },
};
