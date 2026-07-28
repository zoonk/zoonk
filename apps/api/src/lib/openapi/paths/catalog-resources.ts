import {
  catalogSearchQuerySchema,
  catalogSearchResponseSchema,
  chapterLessonListResponseSchema,
  chapterResourceSchema,
  courseChapterListResponseSchema,
  courseResourceSchema,
  languageCourseListResponseSchema,
  languageCourseQuerySchema,
  lessonResourceSchema,
} from "../schemas/catalog-resources";
import {
  chapterPathParamsSchema,
  coursePathParamsSchema,
  lessonPathParamsSchema,
} from "../schemas/paths";
import { notFoundResponse, validationErrorResponse } from "../schemas/responses";
import { PUBLIC_SECURITY } from "../security";

const resourceNotFoundResponses = { "400": validationErrorResponse, "404": notFoundResponse };

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
      operationId: "getChapter",
      requestParams: { path: chapterPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: chapterResourceSchema } },
          description: "Published chapter metadata",
        },
        ...resourceNotFoundResponses,
      },
      security: PUBLIC_SECURITY,
      summary: "Get a chapter",
      tags: ["Chapters"],
    },
  },
  "/chapters/{chapterId}/lessons": {
    get: {
      operationId: "listChapterLessons",
      requestParams: { path: chapterPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: chapterLessonListResponseSchema } },
          description: "Complete published lesson resources in authored order",
        },
        ...resourceNotFoundResponses,
      },
      security: PUBLIC_SECURITY,
      summary: "List chapter lessons",
      tags: ["Lessons"],
    },
  },
  "/courses/{courseId}": {
    get: {
      operationId: "getCourse",
      requestParams: { path: coursePathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: courseResourceSchema } },
          description: "Published course metadata",
        },
        ...resourceNotFoundResponses,
      },
      security: PUBLIC_SECURITY,
      summary: "Get a course",
      tags: ["Courses"],
    },
  },
  "/courses/{courseId}/chapters": {
    get: {
      operationId: "listCourseChapters",
      requestParams: { path: coursePathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: courseChapterListResponseSchema } },
          description: "Complete published chapter resources in authored order",
        },
        ...resourceNotFoundResponses,
      },
      security: PUBLIC_SECURITY,
      summary: "List course chapters",
      tags: ["Chapters"],
    },
  },
  "/language-courses": {
    get: {
      operationId: "listLanguageCourses",
      requestParams: { query: languageCourseQuerySchema },
      responses: {
        "200": {
          content: { "application/json": { schema: languageCourseListResponseSchema } },
          description: "Completed language courses",
        },
        "400": validationErrorResponse,
      },
      security: PUBLIC_SECURITY,
      summary: "List completed language courses",
      tags: ["Courses"],
    },
  },
  "/lessons/{lessonId}": {
    get: {
      operationId: "getLesson",
      requestParams: { path: lessonPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: lessonResourceSchema } },
          description: "Published lesson metadata",
        },
        ...resourceNotFoundResponses,
      },
      security: PUBLIC_SECURITY,
      summary: "Get a lesson",
      tags: ["Lessons"],
    },
  },
};
