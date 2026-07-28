import { resourcePageQuerySchema } from "../schemas/catalog-resources";
import {
  courseContinuationListResponseSchema,
  currentUserCourseListResponseSchema,
  lessonVisibilitySchema,
  lessonVisibilityUpdateSchema,
} from "../schemas/current-learning";
import { coursePathParamsSchema } from "../schemas/paths";
import { badRequestResponse, forbiddenResponse, unauthorizedResponse } from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

export const currentLearningPaths = {
  "/me/course-continuations": {
    get: {
      operationId: "listCurrentUserCourseContinuations",
      responses: {
        "200": {
          content: { "application/json": { schema: courseContinuationListResponseSchema } },
          description: "Current continuation targets",
        },
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "List current user's course continuations",
      tags: ["Progress"],
    },
  },
  "/me/courses": {
    get: {
      operationId: "listCurrentUserCourses",
      requestParams: { query: resourcePageQuerySchema },
      responses: {
        "200": {
          content: { "application/json": { schema: currentUserCourseListResponseSchema } },
          description: "Paginated learner course library",
        },
        "400": badRequestResponse,
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "List current user's courses",
      tags: ["Courses"],
    },
  },
  "/me/courses/{courseId}": {
    delete: {
      operationId: "removeCurrentUserCourse",
      requestParams: { path: coursePathParamsSchema },
      responses: {
        "204": { description: "Course removed from learner library" },
        "400": badRequestResponse,
        "401": unauthorizedResponse,
        "403": forbiddenResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Remove a course from the current user's library",
      tags: ["Courses"],
    },
  },
  "/me/lesson-visibility": {
    get: {
      operationId: "getCurrentUserLessonVisibility",
      responses: {
        "200": {
          content: { "application/json": { schema: lessonVisibilitySchema } },
          description: "Current lesson visibility preferences",
        },
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get current user's lesson visibility",
      tags: ["Progress"],
    },
    patch: {
      operationId: "updateCurrentUserLessonVisibility",
      requestBody: {
        content: { "application/json": { schema: lessonVisibilityUpdateSchema } },
        required: true,
      },
      responses: {
        "200": {
          content: { "application/json": { schema: lessonVisibilitySchema } },
          description: "Updated lesson visibility preferences",
        },
        "400": badRequestResponse,
        "401": unauthorizedResponse,
        "403": forbiddenResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Update current user's lesson visibility",
      tags: ["Progress"],
    },
  },
};
