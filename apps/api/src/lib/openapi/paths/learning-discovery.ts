import {
  discoveryAnswerInputSchema,
  discoveryRevisionInputSchema,
  learningRequestInputSchema,
} from "@zoonk/core/courses/discovery-contract";
import {
  chapterActivitiesQuerySchema,
  chapterActivitiesResponseSchema,
  curriculumGenerationViewSchema,
  discoveryPathParamsSchema,
  discoveryResponseSchema,
  discoveryStartResponseSchema,
  emptyDiscoveryBodySchema,
  learningRequestResponseSchema,
  optionalActivitiesResponseSchema,
  optionalActivityBodySchema,
  optionalActivityStartResponseSchema,
  startDiscoveryBodySchema,
} from "../schemas/learning-discovery";
import {
  chapterPathParamsSchema,
  coursePathParamsSchema,
  lessonPathParamsSchema,
} from "../schemas/paths";
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

const discoveryResponses = {
  "200": {
    content: { "application/json": { schema: discoveryResponseSchema } },
    description: "The owner-private discovery with the next material question or ready brief",
  },
  "400": validationErrorResponse,
  "401": unauthorizedResponse,
  "403": forbiddenResponse,
  "404": notFoundResponse,
  "409": conflictResponse,
  "422": unprocessableEntityResponse,
  "429": tooManyRequestsResponse,
};
export const learningDiscoveryPaths = {
  "/chapters/{chapterId}/optional-activities": {
    get: {
      operationId: "listChapterOptionalActivities",
      requestParams: { path: chapterPathParamsSchema, query: chapterActivitiesQuerySchema },
      responses: {
        "200": {
          content: { "application/json": { schema: chapterActivitiesResponseSchema } },
          description:
            "Optional activities grouped under available teaching sources; a read creates no activities",
        },
        "400": validationErrorResponse,
        "404": notFoundResponse,
      },
      security: OPTIONAL_AUTHENTICATION_SECURITY,
      summary: "List optional activities for a chapter",
      tags: ["Lessons"],
    },
  },

  "/courses/{courseId}/curriculum-generation": {
    get: {
      description:
        "Reads current version and generation state without claiming quota or starting work. Private courses are owner-only.",
      operationId: "getCourseCurriculumGenerationView",
      requestParams: { path: coursePathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: curriculumGenerationViewSchema } },
          description: "Current curriculum generation state",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Read a course curriculum update state",
      tags: ["Generations"],
    },
  },
  "/learning-requests": {
    post: {
      description:
        "Guests can resolve an already available exact public subject. Authentication is required before AI classification or private request storage. Returns an existing course, public generation request, owner-private discovery, or an ordered Track. Personal details never enter a reusable public prompt.",
      operationId: "resolveLearningRequest",
      requestBody: {
        content: { "application/json": { schema: learningRequestInputSchema } },
        required: true,
      },
      responses: {
        "200": {
          content: { "application/json": { schema: learningRequestResponseSchema } },
          description: "Resolved learning destination",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "403": forbiddenResponse,
        "429": tooManyRequestsResponse,
      },
      security: OPTIONAL_AUTHENTICATION_SECURITY,
      summary: "Resolve a learning request",
      tags: ["Learning discovery"],
    },
  },
  "/lessons/{lessonId}/optional-activities": {
    get: {
      description:
        "Shows optional activities beside a teaching lesson. Missing activities remain null on this read. Private sources require their owner.",
      operationId: "getLessonOptionalActivities",
      requestParams: { path: lessonPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: optionalActivitiesResponseSchema } },
          description: "Teaching source and optional activities",
        },
        "400": validationErrorResponse,
        "404": notFoundResponse,
      },
      security: OPTIONAL_AUTHENTICATION_SECURITY,
      summary: "Read optional quiz and practice activities",
      tags: ["Lessons"],
    },
  },
  "/me/course-discoveries": {
    post: {
      description:
        "Reuses the current learner's identical request on retry. Asks only material questions, one at a time. Daily operational limits do not impose a lifetime question count.",
      operationId: "createCurrentUserCourseDiscovery",
      requestBody: {
        content: { "application/json": { schema: learningRequestInputSchema } },
        required: true,
      },
      responses: discoveryResponses,
      security: AUTHENTICATED_SECURITY,
      summary: "Start private learning discovery",
      tags: ["Learning discovery"],
    },
  },
  "/me/course-discoveries/{discoveryId}": {
    get: {
      operationId: "getCurrentUserCourseDiscovery",
      requestParams: { path: discoveryPathParamsSchema },
      responses: discoveryResponses,
      security: AUTHENTICATED_SECURITY,
      summary: "Read private learning discovery",
      tags: ["Learning discovery"],
    },
    patch: {
      description:
        "Uses the original server-owned question and discards later dependent answers. Only unfinished discovery can be revised; stale revisions return conflict.",
      operationId: "reviseCurrentUserCourseDiscovery",
      requestBody: {
        content: { "application/json": { schema: discoveryRevisionInputSchema } },
        required: true,
      },
      requestParams: { path: discoveryPathParamsSchema },
      responses: discoveryResponses,
      security: AUTHENTICATED_SECURITY,
      summary: "Correct an earlier discovery answer",
      tags: ["Learning discovery"],
    },
  },
  "/me/course-discoveries/{discoveryId}/answers": {
    post: {
      description:
        "Supply exactly one option ID, custom answer, or skip for an optional question. The expected revision rejects duplicate or stale submissions.",
      operationId: "answerCurrentUserCourseDiscovery",
      requestBody: {
        content: { "application/json": { schema: discoveryAnswerInputSchema } },
        required: true,
      },
      requestParams: { path: discoveryPathParamsSchema },
      responses: discoveryResponses,
      security: AUTHENTICATED_SECURITY,
      summary: "Answer the current discovery question",
      tags: ["Learning discovery"],
    },
  },
  "/me/course-discoveries/{discoveryId}/retry": {
    post: {
      description:
        "Retries a failed or expired pending operation while preserving completed answers. An active operation cannot be duplicated.",
      operationId: "retryCurrentUserCourseDiscovery",
      requestBody: {
        content: { "application/json": { schema: emptyDiscoveryBodySchema } },
        required: true,
      },
      requestParams: { path: discoveryPathParamsSchema },
      responses: discoveryResponses,
      security: AUTHENTICATED_SECURITY,
      summary: "Retry interrupted discovery",
      tags: ["Learning discovery"],
    },
  },
  "/me/course-discoveries/{discoveryId}/start": {
    post: {
      description:
        "Rechecks completed material scope before creating private content or a focused path through a reusable course. An explicit generation resource can be submitted to POST /generations; resume this discovery after generation to apply the saved private goal.",
      operationId: "startCurrentUserCourseDiscovery",
      requestBody: {
        content: { "application/json": { schema: startDiscoveryBodySchema } },
        required: true,
      },
      requestParams: { path: discoveryPathParamsSchema },
      responses: {
        ...discoveryResponses,
        "200": {
          content: { "application/json": { schema: discoveryStartResponseSchema } },
          description: "Selected learning path, generation requirement, or unsupported scope",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Start the resolved learning plan",
      tags: ["Learning discovery"],
    },
  },
  "/me/lessons/{lessonId}/optional-activities": {
    post: {
      description:
        "Reuses an existing activity or creates one pending shell on explicit request. Submit a returned generation resource to POST /generations. Activities never count toward required course progress.",
      operationId: "startLessonOptionalActivity",
      requestBody: {
        content: { "application/json": { schema: optionalActivityBodySchema } },
        required: true,
      },
      requestParams: { path: lessonPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: optionalActivityStartResponseSchema } },
          description: "Ready activity or explicit generation requirement",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "403": forbiddenResponse,
        "404": notFoundResponse,
        "422": unprocessableEntityResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Start optional quiz or practice",
      tags: ["Lessons"],
    },
  },
};
