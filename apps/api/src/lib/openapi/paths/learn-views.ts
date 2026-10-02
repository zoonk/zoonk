import { areaPracticeInputSchema } from "@zoonk/core/sessions/contract";
import { studySessionErrorCodes } from "../../study-session-errors";
import {
  areaPracticeResponseSchema,
  goalContentResponseSchema,
  goalProgressResponseSchema,
} from "../schemas/learn-views";
import { goalPathParamsSchema } from "../schemas/paths";
import {
  conflictResponse,
  notFoundResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

/** The Progress and Content tabs, read by both modes and native apps. */
export const learnViewPaths = {
  "/goals/{goalId}/area-practice": {
    post: {
      description:
        "\"Practice now\" on an area of the goal (from its preparation): a bonus block of practice on that area's studied skills, added to today's session. It can start before the day's session is done, but counts as extra time: at most two bonus blocks a day, never past the daily time limit, with capped Brain Power. Tapping again returns the unfinished block.",
      operationId: "createAreaPractice",
      requestBody: { content: { "application/json": { schema: areaPracticeInputSchema } } },
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "201": {
          content: { "application/json": { schema: areaPracticeResponseSchema } },
          description: "The practice block and its session",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": { ...notFoundResponse, description: "The goal or the area doesn't exist" },
        "409": {
          ...conflictResponse,
          description: `The goal is paused or finished (${studySessionErrorCodes.goalNotActive}), or no more bonus time today, including the daily time limit (${studySessionErrorCodes.extraTimeUnavailable}, details.reason says why).`,
        },
        "422": {
          ...unprocessableEntityResponse,
          description: `Nothing studied in this area to practice yet. Error code: ${studySessionErrorCodes.nothingToPractice}.`,
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Practice an area",
      tags: ["Study sessions"],
    },
  },
  "/goals/{goalId}/content": {
    get: {
      description:
        "The Content tab (Cards in Fun): every skill of the goal as a study card grouped by chapter, with its state and whether it's fading, counts for the filters, today's reviews, the latest lesson summary cards and whether Fun shows Cards yet.",
      operationId: "getGoalContent",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: goalContentResponseSchema } },
          description: "The goal's content",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a goal's content",
      tags: ["Learner"],
    },
  },
  "/goals/{goalId}/progress": {
    get: {
      description:
        "The Progress tab: preparation with the evidence for each part and an estimated score only after a mock exam, mastery per chapter, the skills fading now, open mistakes and this week against the last. Focus draws bars, Fun the preparation ring.",
      operationId: "getGoalProgress",
      requestParams: { path: goalPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: goalProgressResponseSchema } },
          description: "The goal's progress",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a goal's progress",
      tags: ["Learner"],
    },
  },
};
