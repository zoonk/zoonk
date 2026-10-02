import { materialQuestionInputSchema } from "@zoonk/core/library/sources/material-question-contract";
import { goalPathParamsSchema } from "../schemas/paths";
import {
  changeNoticesQuerySchema,
  changeNoticesResponseSchema,
  createResearchRequestSchema,
  createUploadRequestSchema,
  examBlueprintPathParamsSchema,
  examBlueprintResourceSchema,
  freshnessCommandRequestSchema,
  freshnessCommandResponseSchema,
  goalUploadRequestResponseSchema,
  learnerSourcesQuerySchema,
  learnerSourcesResponseSchema,
  materialQuestionAnswerSchema,
  researchPathParamsSchema,
  researchResourceSchema,
  sourcePathParamsSchema,
  sourceResourceSchema,
  uploadResourceSchema,
  uploadTokenRequestSchema,
  uploadTokenResponseSchema,
} from "../schemas/research-sources";
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
import {
  AUTHENTICATED_SECURITY,
  OPTIONAL_AUTHENTICATION_SECURITY,
  PUBLIC_SECURITY,
} from "../security";

const TAGS = ["Sources"];

export const researchSourcePaths = {
  "/exam-blueprints/{blueprintId}": {
    get: {
      operationId: "getExamBlueprint",
      requestParams: { path: examBlueprintPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: examBlueprintResourceSchema } },
          description: "The exam's canonical blueprint and current edition",
        },
        "400": validationErrorResponse,
        "404": notFoundResponse,
      },
      security: OPTIONAL_AUTHENTICATION_SECURITY,
      summary: "Get an exam blueprint",
      tags: TAGS,
    },
  },
  "/freshness/commands": {
    post: {
      operationId: "sendFreshnessCommand",
      requestBody: {
        content: { "application/json": { schema: freshnessCommandRequestSchema } },
        required: true,
      },
      responses: {
        "200": {
          content: { "application/json": { schema: freshnessCommandResponseSchema } },
          description: "A check started, or the checks stopped",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "403": forbiddenResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Check an exam or source now, or stop its checks (admins)",
      tags: TAGS,
    },
  },
  "/goals/{goalId}/upload-request": {
    delete: {
      description:
        "The learner doesn't have the document (the notice isn't out yet, the teacher shared nothing): the ask leaves Plan and Today, and the plan keeps following the goal as typed.",
      operationId: "dismissGoalUploadRequest",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "204": { description: "Dismissed" },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Dismiss what research asked to upload",
      tags: TAGS,
    },
    get: {
      description:
        "What research is waiting for on one of the learner's goals: the official notice or source it couldn't find or verify, or the class's material for a teacher's test. Plan and Today show it until the learner answers with `POST /v1/research` and the uploaded `sourceIds`, which clears it and rebuilds the goal's curriculum once research has read the upload.",
      operationId: "getGoalUploadRequest",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: goalUploadRequestResponseSchema } },
          description: "The upload research asked for, or null",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get what research asked to upload",
      tags: TAGS,
    },
  },
  "/material-questions": {
    post: {
      operationId: "askMaterialQuestion",
      requestBody: {
        content: { "application/json": { schema: materialQuestionInputSchema } },
        required: true,
      },
      responses: {
        "200": {
          content: { "application/json": { schema: materialQuestionAnswerSchema } },
          description: "The answer from the learner's material, with the pages it came from",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "402": paymentRequiredResponse,
        "403": forbiddenResponse,
        "404": notFoundResponse,
        "429": tooManyRequestsResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Ask a question about your own material",
      tags: TAGS,
    },
  },
  "/research": {
    post: {
      description:
        "Starts research for one of the learner's goals: an exam's blueprint, the current law or documentation a goal depends on, or a big learn goal's reference syllabi. Research runs once per goal: asking again returns the run that researched it, running or done, and only a failed run starts over. With `sourceIds`, it answers the goal's open upload request, once: the ask is cleared at once, research reads the uploads instead of searching, and the goal's curriculum is rebuilt from them once research has read them.",
      operationId: "createResearch",
      requestBody: {
        content: { "application/json": { schema: createResearchRequestSchema } },
        required: true,
      },
      responses: {
        "202": {
          content: { "application/json": { schema: researchResourceSchema } },
          description: "Research started, or the goal's research run to follow",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
        "409": { ...conflictResponse, description: "The goal has no upload request to answer" },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Research the dated sources a goal depends on",
      tags: TAGS,
    },
  },
  "/research/{researchId}": {
    get: {
      operationId: "getResearch",
      requestParams: { path: researchPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: researchResourceSchema } },
          description: "The research run and, once completed, its result",
        },
        "400": validationErrorResponse,
        "404": notFoundResponse,
      },
      security: PUBLIC_SECURITY,
      summary: "Get a research run",
      tags: TAGS,
    },
  },
  "/source-change-notices": {
    get: {
      operationId: "listSourceChangeNotices",
      requestParams: { query: changeNoticesQuerySchema },
      responses: {
        "200": {
          content: { "application/json": { schema: changeNoticesResponseSchema } },
          description: "Recent changes to what the goal studies, one line each",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "List change notices for a goal",
      tags: TAGS,
    },
  },
  "/sources": {
    get: {
      operationId: "listLearnerSources",
      requestParams: { query: learnerSourcesQuerySchema },
      responses: {
        "200": {
          content: { "application/json": { schema: learnerSourcesResponseSchema } },
          description: "The learner's uploads and the sources research found for their goals",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "List the learner's material",
      tags: TAGS,
    },
  },
  "/sources/{sourceId}": {
    get: {
      operationId: "getSource",
      requestParams: { path: sourcePathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: sourceResourceSchema } },
          description: "The source",
        },
        "400": validationErrorResponse,
        "404": notFoundResponse,
      },
      security: OPTIONAL_AUTHENTICATION_SECURITY,
      summary: "Get a source",
      tags: TAGS,
    },
  },
  "/uploads": {
    post: {
      operationId: "createUpload",
      requestBody: {
        content: { "application/json": { schema: createUploadRequestSchema } },
        required: true,
      },
      responses: {
        "201": {
          content: { "application/json": { schema: uploadResourceSchema } },
          description: "Upload stored",
        },
        "400": badRequestResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
        "422": unprocessableEntityResponse,
        "429": tooManyRequestsResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Register an uploaded file, or pasted text or link, as a source",
      tags: TAGS,
    },
  },
  "/uploads/tokens": {
    post: {
      operationId: "createUploadToken",
      requestBody: {
        content: { "application/json": { schema: uploadTokenRequestSchema } },
        required: true,
      },
      responses: {
        "200": {
          content: { "application/json": { schema: uploadTokenResponseSchema } },
          description:
            "A signed, short-lived URL payload to upload one file straight to Blob storage",
        },
        "400": badRequestResponse,
        "401": unauthorizedResponse,
        "429": tooManyRequestsResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Sign a file upload",
      tags: TAGS,
    },
  },
};
