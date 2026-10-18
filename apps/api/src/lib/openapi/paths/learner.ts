import { reviewScheduleInputSchema, skillListInputSchema } from "@zoonk/core/learner/contract";
import { reviewScheduleResponseSchema, skillListResponseSchema } from "../schemas/learner";
import { goalPathParamsSchema } from "../schemas/paths";
import { goalPreparationResponseSchema } from "../schemas/preparation";
import {
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

export const learnerPaths = {
  "/goals/{goalId}/preparation": {
    get: {
      description:
        "Coverage, mastery on unseen questions, retention and recent tests (an exam's mock exams, or another goal's weekly challenges) with their evidence, the plan status, each area, and, for an exam, an estimated score range only after a mock exam. A quick explanation has no preparation (404).",
      operationId: "getGoalPreparation",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: goalPreparationResponseSchema } },
          description: "The goal's preparation",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a goal's preparation",
      tags: ["Learner"],
    },
  },
  "/me/reviews": {
    get: {
      description:
        "Today's reviews under the daily cap, most at risk of being forgotten first, and the load of the next seven days. Overdue reviews spread over the next days instead of piling up.",
      operationId: "getCurrentUserReviewSchedule",
      requestParams: { query: reviewScheduleInputSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: reviewScheduleResponseSchema } },
          description: "The learner's review schedule",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get the current learner's review schedule",
      tags: ["Learner"],
    },
  },
  "/me/skills": {
    get: {
      description:
        "The learner's skills as study cards with their mastery state, whether they are fading, and counts per state for the filters. With a goal, every skill of its plan, New ones included.",
      operationId: "listCurrentUserSkills",
      requestParams: { query: skillListInputSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: skillListResponseSchema } },
          description: "The learner's skills",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "List the current learner's skills",
      tags: ["Learner"],
    },
  },
};
