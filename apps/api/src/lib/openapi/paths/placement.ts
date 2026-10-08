import {
  placementAnswerInputSchema,
  placementCompletionInputSchema,
  placementQuerySchema,
} from "@zoonk/core/learner/placement/contract";
import { chapterTestOutInputSchema } from "@zoonk/core/learner/test-out/contract";
import { z } from "zod";
import {
  chapterTestOutResponseSchema,
  chapterTestOutResultSchema,
  placementAnswerResponseSchema,
  placementCompletionResponseSchema,
  placementResponseSchema,
  testOutGenerationSchema,
} from "../schemas/learner";
import { goalChapterPathParamsSchema, goalPathParamsSchema } from "../schemas/paths";
import {
  forbiddenResponse,
  notFoundResponse,
  paymentRequiredResponse,
  tooManyRequestsResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

const learnerErrors = {
  "400": validationErrorResponse,
  "401": unauthorizedResponse,
  "404": notFoundResponse,
} as const;

export const placementPaths = {
  "/goals/{goalId}/chapters/{chapterId}/test-out": {
    get: {
      description:
        "One question per sampled skill of the chapter, unseen questions first. Nothing is stored until the answers are submitted.",
      operationId: "getChapterTestOut",
      requestParams: { path: goalChapterPathParamsSchema },
      responses: {
        ...learnerErrors,
        "200": {
          content: { "application/json": { schema: chapterTestOutResponseSchema } },
          description: "The chapter's test-out questions",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a chapter test-out",
      tags: ["Learner"],
    },
    post: {
      description:
        "Grades the test-out. Passing (at least four answers, every sampled skill answered, 80% right) marks the skills answered 80% right known and tests out the plan items that teach only known skills.",
      operationId: "submitChapterTestOut",
      requestBody: {
        content: { "application/json": { schema: chapterTestOutInputSchema } },
        required: true,
      },
      requestParams: { path: goalChapterPathParamsSchema },
      responses: {
        ...learnerErrors,
        "200": {
          content: { "application/json": { schema: chapterTestOutResultSchema } },
          description: "The test-out result",
        },
        "422": unprocessableEntityResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Submit a chapter test-out",
      tags: ["Learner"],
    },
  },
  "/goals/{goalId}/chapters/{chapterId}/test-out/generations": {
    post: {
      description:
        "Gets a chapter's test-out ready when the learner asks for it (never on a screen view). `ready` when it has a question for every skill it samples. Otherwise a run writes a few multiple-choice questions for each skill without one (shared with placement, reviews and practice) and answers 202; a second request joins that run. Each start counts as small AI help, so a refusal is `SLOW_DOWN` or `USAGE_LIMIT_REACHED`.",
      operationId: "createChapterTestOutGeneration",
      requestParams: { path: goalChapterPathParamsSchema },
      responses: {
        ...learnerErrors,
        "200": {
          content: { "application/json": { schema: testOutGenerationSchema } },
          description: "The test-out has its questions",
        },
        "202": {
          content: { "application/json": { schema: testOutGenerationSchema } },
          description: "A run is writing the questions",
          headers: z.object({
            Location: z
              .string()
              .meta({ description: "The run's status URL: GET /generations/{generationId}" }),
          }),
        },
        "402": paymentRequiredResponse,
        "403": forbiddenResponse,
        "429": tooManyRequestsResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Write a chapter test-out's questions",
      tags: ["Learner"],
    },
  },
  "/goals/{goalId}/placement": {
    get: {
      description:
        "Each phase's and each area's starting point, and what to do next (`status`). Placement asks the plan's areas in turns, starts each where the learner's own level points, asks harder questions after right answers and easier ones after wrong ones, and stops when every area of every phase has a confident starting point, not after a set number of questions. Before the goal's skill map exists, `status` is `preparing` and `complete` is false.",
      operationId: "getGoalPlacement",
      requestParams: { path: goalPathParamsSchema, query: placementQuerySchema },
      responses: {
        ...learnerErrors,
        "200": {
          content: { "application/json": { schema: placementResponseSchema } },
          description: "The goal's placement",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a goal's placement",
      tags: ["Learner"],
    },
  },
  "/goals/{goalId}/placement/answers": {
    post: {
      description:
        'Grades one placement answer, including "I don\'t know yet", and returns the updated placement with the next question. Placement answers never go to the mistakes notebook.',
      operationId: "createPlacementAnswer",
      requestBody: {
        content: { "application/json": { schema: placementAnswerInputSchema } },
        required: true,
      },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        ...learnerErrors,
        "200": {
          content: { "application/json": { schema: placementAnswerResponseSchema } },
          description: "The graded answer and the updated placement",
        },
        "422": unprocessableEntityResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Answer a placement question",
      tags: ["Learner"],
    },
  },
  "/goals/{goalId}/placement/completion": {
    post: {
      description:
        "Ends placement at any time. Skills placement is sure about become known and the plan skips what they cover. With fromScratch, nothing changes and every phase and area starts at its beginning. Finishing before the goal's skill map exists places nothing: `complete` is false. The lesson the plan now opens with starts being written, counted as its start like opening it, so it's ready when the first session reaches it; for a learner with an account, Day 1's next lessons and the next study day's first ones are written too (see createGoalLessonPreparation).",
      operationId: "completeGoalPlacement",
      requestBody: {
        content: { "application/json": { schema: placementCompletionInputSchema } },
        required: true,
      },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        ...learnerErrors,
        "200": {
          content: { "application/json": { schema: placementCompletionResponseSchema } },
          description: "Where each phase and area starts",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Finish a goal's placement",
      tags: ["Learner"],
    },
  },
};
