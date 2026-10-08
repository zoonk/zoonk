import { suggestedGoalAnswerSchema } from "@zoonk/core/goals/suggestions/contract";
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
        "Today, the screen learners open every day, for a goal (the active goal by default): the goal and its countdown, the status line (plan status and preparation), today's session (built the first time it's opened on the learner's local day), the week, the week's checkpoint and at most one insight.",
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
};
