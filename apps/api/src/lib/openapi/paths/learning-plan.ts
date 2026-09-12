import {
  courseLearningPathSchema,
  coursePlanResponseSchema,
  startCourseBodySchema,
  startCourseResponseSchema,
  updateLearningPlanBodySchema,
} from "../schemas/learning-plan";
import { coursePathParamsSchema } from "../schemas/paths";
import {
  conflictResponse,
  forbiddenResponse,
  notFoundResponse,
  tooManyRequestsResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY, OPTIONAL_AUTHENTICATION_SECURITY } from "../security";

const planResponses = {
  "200": {
    content: { "application/json": { schema: coursePlanResponseSchema } },
    description: "The current learner's course-specific preferences and selected chapters",
  },
  "400": validationErrorResponse,
  "401": unauthorizedResponse,
  "404": notFoundResponse,
};

export const learningPlanPaths = {
  "/courses/{courseId}/learning-path": {
    get: {
      description:
        "Returns the saved learner path, or the default curriculum for a guest. Reads never generate content or change preferences. Private courses are visible only to their owner.",
      operationId: "getCourseLearningPath",
      requestParams: { path: coursePathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: courseLearningPathSchema } },
          description:
            "Selected teaching lessons, progress, and the next available learning target",
        },
        "400": validationErrorResponse,
        "404": notFoundResponse,
        "422": unprocessableEntityResponse,
        "429": tooManyRequestsResponse,
      },
      security: OPTIONAL_AUTHENTICATION_SECURITY,
      summary: "Read a course learning path",
      tags: ["Learning plans"],
    },
  },

  "/me/courses/{courseId}/learning-plan": {
    get: {
      operationId: "getCurrentUserCoursePlan",
      requestParams: { path: coursePathParamsSchema },
      responses: planResponses,
      security: AUTHENTICATED_SECURITY,
      summary: "Read course-specific learning preferences",
      tags: ["Learning plans"],
    },
    put: {
      description:
        "Replaces course-specific preferences. A focused goal selects from the actual reusable curriculum and includes required prerequisites. Pass the last revision (zero for a new plan) to reject stale edits. Historical learning progress is preserved.",
      operationId: "updateCurrentUserCoursePlan",
      requestBody: {
        content: { "application/json": { schema: updateLearningPlanBodySchema } },
        required: true,
      },
      requestParams: { path: coursePathParamsSchema },
      responses: {
        ...planResponses,
        "403": forbiddenResponse,
        "409": conflictResponse,
        "422": unprocessableEntityResponse,
        "429": tooManyRequestsResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Update a course learning plan",
      tags: ["Learning plans"],
    },
  },
  "/me/courses/{courseId}/start": {
    post: {
      description:
        "Enrolls the current learner and optionally saves preferences. Returns the next learning target, or an explicit curriculum generation resource when the chosen path requires an updated outline. Submit that resource to POST /generations to begin generation.",
      operationId: "startCurrentUserCourse",
      requestBody: {
        content: { "application/json": { schema: startCourseBodySchema } },
        required: true,
      },
      requestParams: { path: coursePathParamsSchema },
      responses: {
        ...planResponses,
        "200": {
          content: { "application/json": { schema: startCourseResponseSchema } },
          description: "The next learning step or curriculum generation requirement",
        },
        "403": forbiddenResponse,
        "409": conflictResponse,
        "422": unprocessableEntityResponse,
        "429": tooManyRequestsResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Start or resume a course",
      tags: ["Learning plans"],
    },
  },
};
