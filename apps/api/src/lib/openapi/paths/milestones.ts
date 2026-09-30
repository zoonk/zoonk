import { buddyStatusInputSchema, weeklyRecapInputSchema } from "@zoonk/core/milestones/contract";
import { milestoneSchema } from "@zoonk/core/sessions/completion-contract";
import {
  buddyStatusResponseSchema,
  milestoneListResponseSchema,
  weeklyRecapResponseSchema,
} from "../schemas/milestones";
import { milestonePathParamsSchema } from "../schemas/paths";
import {
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

const TAGS = ["Milestones"];

export const milestonePaths = {
  "/me/buddy": {
    get: {
      description:
        "The buddy's page: its Energy and whether it naps, is awake or glows, its stage and the Brain Power to the next one, what it ate this week and the glasses. Learners without a buddy get the same numbers with `buddy` null.",
      operationId: "getCurrentUserBuddy",
      requestParams: { query: buddyStatusInputSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: buddyStatusResponseSchema } },
          description: "The buddy's status",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get the current learner's buddy",
      tags: TAGS,
    },
  },
  "/me/milestones": {
    get: {
      description:
        'The learner\'s milestones: every pair of glasses with how far it is ("4/7 full meals"), badges for the logbook, belts and buddy stages, and the one milestone to celebrate next. Nothing is random or sold.',
      operationId: "listCurrentUserMilestones",
      responses: {
        "200": {
          content: { "application/json": { schema: milestoneListResponseSchema } },
          description: "The learner's milestones",
        },
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "List the current learner's milestones",
      tags: TAGS,
    },
  },
  "/me/milestones/{milestoneId}/views": {
    post: {
      description:
        "Records that a milestone was celebrated, so it shows only once. Showing it again keeps the first time.",
      operationId: "createMilestoneView",
      requestParams: { path: milestonePathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: milestoneSchema } },
          description: "The milestone, marked as shown",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Mark a milestone as shown",
      tags: TAGS,
    },
  },
  "/me/weekly-recap": {
    get: {
      description:
        "The week's logbook: days studied, minutes and questions against the learner's own last week, the biggest turnaround and why, badges, what the buddy ate, phases finished and next week's focus. Ready on Sunday.",
      operationId: "getCurrentUserWeeklyRecap",
      requestParams: { query: weeklyRecapInputSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: weeklyRecapResponseSchema } },
          description: "The week's recap",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get the current learner's weekly recap",
      tags: TAGS,
    },
  },
};
