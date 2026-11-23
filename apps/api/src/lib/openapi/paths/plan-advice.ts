import { planBasesAdviceSchema } from "@zoonk/core/plans/bases-advice-contract";
import {
  planTimeAdviceSchema,
  planTimeToCoverSchema,
} from "@zoonk/core/plans/time-advice-contract";
import { goalPathParamsSchema } from "../schemas/paths";
import {
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { planTimeAdviceInputSchema, planTimeToCoverInputSchema } from "../schemas/time-advice";
import { AUTHENTICATED_SECURITY } from "../security";

const planErrors = {
  "400": validationErrorResponse,
  "401": unauthorizedResponse,
  "404": notFoundResponse,
} as const;

export const planAdvicePaths = {
  "/goals/{goalId}/plan/bases-advice": {
    post: {
      description:
        "What the app recommends for the plan's bases (quick, essential or in depth), when the learner asks for it: it plans the goal with every base in depth to see whether their time covers everything then, so it's a request the learner makes, never part of reading the plan. `ready` is false while the plan is being built: ask again in a few seconds.",
      operationId: "createPlanBasesAdvice",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        ...planErrors,
        "200": {
          content: { "application/json": { schema: planBasesAdviceSchema } },
          description: "What the app recommends for the plan's bases",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a recommendation for a plan's bases",
      tags: ["Plans"],
    },
  },
  "/goals/{goalId}/plan/time-advice": {
    post: {
      description:
        "What a daily time covers by the goal's date, in the week asked about (its study days, and the weekend's own time, which a new daily time leaves as it is): the plan that time plans, as the plan shows it once the learner chooses it. For an exam asked about with `fullCourse=true`, the plan that studies everything, going on after the exam, and the day it ends. Only that time: the time that covers everything is asked for with `POST /goals/{goalId}/plan/time-to-cover`. `ready` is false while the plan is being built: ask again in a few seconds.",
      operationId: "getPlanTimeAdvice",
      requestBody: {
        content: { "application/json": { schema: planTimeAdviceInputSchema } },
        required: true,
      },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        ...planErrors,
        "200": {
          content: { "application/json": { schema: planTimeAdviceSchema } },
          description: "What the daily time asked about covers",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get what a daily time covers",
      tags: ["Plans"],
    },
  },
  "/goals/{goalId}/plan/time-to-cover": {
    post: {
      description:
        "Finds the suggested daily study time (at most 4 hours) for the goal's date and the study week requested. Also returns the fitting time in `recommendedMinutes` when one exists, which can exceed the 8-hour limit for a learner's schedule, and the earliest later fitting date at the saved time for eligible non-exam goals. A goal with a passed date has no suggested time. This calculation can take seconds for a large exam. It makes no changes, and `ready` is false while the plan is being built.",
      operationId: "findPlanTimeToCover",
      requestBody: {
        content: { "application/json": { schema: planTimeToCoverInputSchema } },
        required: true,
      },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        ...planErrors,
        "200": {
          content: { "application/json": { schema: planTimeToCoverSchema } },
          description: "The suggested daily study time and fit estimates",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Find the suggested daily study time",
      tags: ["Plans"],
    },
  },
};
