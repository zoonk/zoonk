import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import {
  challengeMoveResponseSchema,
  challengeResponseSchema,
  challengeStartResponseSchema,
  challengeUndoResponseSchema,
  checkpointMoveResponseSchema,
  checkpointResponseSchema,
} from "../schemas/checkpoints";
import {
  challengeMovePathParamsSchema,
  challengePathParamsSchema,
  checkpointMovePathParamsSchema,
  checkpointPathParamsSchema,
} from "../schemas/paths";
import {
  conflictResponse,
  forbiddenResponse,
  notFoundResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

export const checkpointPaths = {
  "/challenges/{planItemId}": {
    get: {
      description:
        "A plan's phase boss or the week's Big Challenge (an exam's mock), by its plan item, before its day and on it: when it is, what it asks (questions, minutes, a mock's sections and start time), what it's worth, whether it can move to Monday, and where it stands today. On its day, start it to open its block of today's session.",
      operationId: "getChallenge",
      requestParams: { path: challengePathParamsSchema, query: studySessionTimeZoneInputSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: challengeResponseSchema } },
          description: "The challenge",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a challenge",
      tags: ["Study sessions"],
    },
  },
  "/challenges/{planItemId}/moves": {
    post: {
      description:
        "\"Move to Monday\" from the challenge itself, before its day or on it: the week's Big Challenge that hasn't started moves to the next Monday through the plan (a past day can't move). The plan change can be undone. A dated plan item is a new one once it moves, so the response names it.",
      operationId: "moveChallenge",
      requestBody: {
        content: { "application/json": { schema: studySessionTimeZoneInputSchema } },
        required: true,
      },
      requestParams: { path: challengePathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: challengeMoveResponseSchema } },
          description: "Where it moved",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
        "409": {
          ...conflictResponse,
          description: "It isn't a weekly challenge, it started, or its day is past",
        },
        "422": unprocessableEntityResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Move a challenge to Monday",
      tags: ["Study sessions"],
    },
  },
  "/challenges/{planItemId}/moves/{changeId}": {
    delete: {
      description:
        "Undoes a move, from the challenge on its new day, while the plan is as the move left it: the challenge goes back to its day and, when that's today, back into today's session. The response names its plan item there.",
      operationId: "undoChallengeMove",
      requestParams: {
        path: challengeMovePathParamsSchema,
        query: studySessionTimeZoneInputSchema,
      },
      responses: {
        "200": {
          content: { "application/json": { schema: challengeUndoResponseSchema } },
          description: "The challenge is back on its day",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
        "409": { ...conflictResponse, description: "The plan changed since the move" },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Undo moving a challenge",
      tags: ["Study sessions"],
    },
  },
  "/challenges/{planItemId}/starts": {
    post: {
      description:
        "Starts a challenge on its day: today's session is planned if it isn't yet, and the challenge's block starts (a mock's sections are fixed and its clock starts). The response says where it's played: a checkpoint (`/checkpoints/{blockId}`) or a mock (`/mocks/{blockId}`).",
      operationId: "startChallenge",
      requestBody: {
        content: { "application/json": { schema: studySessionTimeZoneInputSchema } },
        required: true,
      },
      requestParams: { path: challengePathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: challengeStartResponseSchema } },
          description: "Where it's played",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "403": { ...forbiddenResponse, description: "Today's time limit is reached" },
        "404": notFoundResponse,
        "409": {
          ...conflictResponse,
          description: "It isn't in today's session, or it's already finished",
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Start a challenge",
      tags: ["Study sessions"],
    },
  },
  "/checkpoints/{blockId}": {
    get: {
      description:
        "A checkpoint of the learner's session (the phase boss, the final boss or the weekly Big Challenge), by its block ID: its questions without hints or answers, the pass mark, a mock's time and checklist, what it's worth and, once finished, how it went. Play it through the study session's block endpoints.",
      operationId: "getCheckpoint",
      requestParams: { path: checkpointPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: checkpointResponseSchema } },
          description: "The checkpoint",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get a checkpoint",
      tags: ["Study sessions"],
    },
  },
  "/checkpoints/{blockId}/moves": {
    post: {
      description:
        "\"Move to Monday\": the week's Big Challenge (a mock or a mixed challenge) that hasn't started moves to the next Monday through the plan, and today's block steps aside. The plan change can be undone.",
      operationId: "moveWeeklyChallenge",
      requestBody: {
        content: { "application/json": { schema: studySessionTimeZoneInputSchema } },
        required: true,
      },
      requestParams: { path: checkpointPathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: checkpointMoveResponseSchema } },
          description: "Where it moved",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
        "409": {
          ...conflictResponse,
          description: "It already started, or isn't a weekly challenge",
        },
        "422": unprocessableEntityResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Move the weekly challenge to Monday",
      tags: ["Study sessions"],
    },
  },
  "/checkpoints/{blockId}/moves/{changeId}": {
    delete: {
      description:
        "Undoes a move while the plan is as the move left it: the challenge goes back to its day and, on that day, back into the session.",
      operationId: "undoWeeklyChallengeMove",
      requestParams: {
        path: checkpointMovePathParamsSchema,
        query: studySessionTimeZoneInputSchema,
      },
      responses: {
        "204": { description: "The challenge is back on its day" },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "404": notFoundResponse,
        "409": { ...conflictResponse, description: "The plan changed since the move" },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Undo moving the weekly challenge",
      tags: ["Study sessions"],
    },
  },
};
