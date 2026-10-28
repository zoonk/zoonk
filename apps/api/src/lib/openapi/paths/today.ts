import { suggestedGoalAnswerSchema } from "@zoonk/core/goals/suggestions/contract";
import {
  acknowledgeTodayPlanChangeInputSchema,
  acknowledgedTodayPlanChangeSchema,
} from "@zoonk/core/plans/today-change-contract";
import { todayStudySessionInputSchema } from "@zoonk/core/sessions/contract";
import { studySessionErrorCodes } from "../../study-session-errors";
import { todayErrorCodes } from "../../today-errors";
import { suggestedGoalPathParamsSchema } from "../schemas/paths";
import {
  conflictResponse,
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { suggestedGoalResultSchema } from "../schemas/suggested-goals";
import { todayResponseSchema } from "../schemas/today";
import { AUTHENTICATED_SECURITY } from "../security";

export const todayPaths = {
  "/me/suggested-goals/{suggestionId}": {
    patch: {
      description:
        "Accepts or dismisses a suggested goal from Today. Accepting only records the answer: open onboarding with the suggestion's title as the goal. Either answer closes it, and the next one (if any) shows on Today.",
      operationId: "answerSuggestedGoal",
      requestBody: {
        content: { "application/json": { schema: suggestedGoalAnswerSchema } },
        required: true,
      },
      requestParams: { path: suggestedGoalPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: suggestedGoalResultSchema } },
          description: "The answered suggested goal",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
        "409": {
          ...conflictResponse,
          description: `The suggested goal was already answered. Error code: ${todayErrorCodes.suggestedGoalAlreadyAnswered}.`,
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Answer a suggested goal",
      tags: ["Study sessions"],
    },
  },
  "/today": {
    get: {
      description:
        "Today, the screen learners open every day, for a goal (the active goal by default): the goal and its countdown, the status line (plan status and preparation), the saved day or an unopened preview without persisted IDs (status unstarted), the week, the week's checkpoint, at most one insight and, for a language goal, the pattern noticed in recent mistakes that it offers beside the day. With `timeZone`, the read uses the device's local day without changing the goal or planning. Start follows the device zone and settles the plan. No study session is created or changed: the learner opens the day through POST /v1/goals/{goalId}/study-sessions.",
      operationId: "getToday",
      requestParams: { query: todayStudySessionInputSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: todayResponseSchema } },
          description: "Today",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": {
          ...notFoundResponse,
          description: `The goal doesn't exist, or the learner has no active goal yet (only quick explanations count as none: they have no day to plan). Error code without a goal: ${todayErrorCodes.noGoal}, with \`details.suggestedGoal\` (a SuggestedGoal or null) to offer before opening onboarding.`,
        },
        "409": {
          ...conflictResponse,
          description: `The goal is paused, completed or archived (${studySessionErrorCodes.goalNotActive}), or its plan is still being built after onboarding (${todayErrorCodes.planNotReady}, with the goal in \`details\`): show the wait and ask again.`,
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get Today",
      tags: ["Study sessions"],
    },
  },
  "/today/plan-change/acknowledgments": {
    post: {
      description:
        "Acknowledges Today's mandatory notice in one learner POST. A stored notice uses its UUID. A computed notice has no ID yet: send its goal, shown day and Today's `noticeBasis`. The POST atomically persists the same selected plan, the real notice and its seenAt; it never opens a study session. Replays return the same real notice ID. If the day or the plan changed, read Today again before acknowledging.",
      operationId: "acknowledgeTodayPlanChange",
      requestBody: {
        content: { "application/json": { schema: acknowledgeTodayPlanChangeInputSchema } },
        required: true,
      },
      responses: {
        "200": {
          content: { "application/json": { schema: acknowledgedTodayPlanChangeSchema } },
          description: "The stored notice ID",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
        "409": {
          ...conflictResponse,
          description: `The goal is inactive, or the shown day or plan inputs changed (${todayErrorCodes.planChangeReadChanged}). Read Today again.`,
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Acknowledge Today's plan change",
      tags: ["Study sessions"],
    },
  },
};
