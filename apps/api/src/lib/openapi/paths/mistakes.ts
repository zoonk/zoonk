import {
  mistakePracticeAnswerInputSchema,
  mistakePracticeFinishInputSchema,
  mistakePracticeInputSchema,
} from "@zoonk/core/mistakes/contract";
import {
  mistakeListQuerySchema,
  mistakeListResponseSchema,
  mistakePracticeCompletionSchema,
  mistakePracticeFeedbackSchema,
  mistakePracticeResponseSchema,
} from "../schemas/mistakes";
import { mistakePathParamsSchema } from "../schemas/paths";
import {
  notFoundResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

export const mistakePaths = {
  "/me/mistake-practice": {
    get: {
      description:
        '"Practice mistakes": up to five open mistakes from earlier days, each with a drill chosen by its cause and the questions to answer, the original one first.',
      operationId: "getCurrentUserMistakePractice",
      requestParams: { query: mistakePracticeInputSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: mistakePracticeResponseSchema } },
          description: "The mistakes to practice",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Practice the current learner's mistakes",
      tags: ["Mistakes"],
    },
  },
  "/me/mistake-practice/completions": {
    post: {
      description:
        "Finishes a \"Practice mistakes\" run, at its end or when the learner stops early, so it counts like any practice: Brain Power (due material, with Hyperdrive), Energy, the answers and time in today's totals and a learning day. Send the answer ids the run's answers returned. Finishing the same answers again counts nothing new and returns what the run earned.",
      operationId: "createMistakePracticeCompletion",
      requestBody: {
        content: { "application/json": { schema: mistakePracticeFinishInputSchema } },
        required: true,
      },
      responses: {
        "200": {
          content: { "application/json": { schema: mistakePracticeCompletionSchema } },
          description: "What the run earned",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
        "422": unprocessableEntityResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Finish a mistake practice run",
      tags: ["Mistakes"],
    },
  },
  "/me/mistakes": {
    get: {
      description:
        "The mistakes notebook, newest first, filterable by goal, skill, cause and status, with counts for the filters. Every entry keeps the question and answers as text.",
      operationId: "listCurrentUserMistakes",
      requestParams: { query: mistakeListQuerySchema },
      responses: {
        "200": {
          content: { "application/json": { schema: mistakeListResponseSchema } },
          description: "A page of the mistakes notebook",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "List the current learner's mistakes",
      tags: ["Mistakes"],
    },
  },
  "/me/mistakes/{mistakeId}/answers": {
    post: {
      description:
        "Answers the mistake's question or another question on its skill, by the rules of its drill. Right on a later day than the mistake, it fixes the entry. The run counts toward today when it's finished (POST /me/mistake-practice/completions).",
      operationId: "createMistakePracticeAnswer",
      requestBody: {
        content: { "application/json": { schema: mistakePracticeAnswerInputSchema } },
        required: true,
      },
      requestParams: { path: mistakePathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: mistakePracticeFeedbackSchema } },
          description: "Feedback and where the entry stands",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
        "422": unprocessableEntityResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Answer a mistake practice question",
      tags: ["Mistakes"],
    },
  },
};
