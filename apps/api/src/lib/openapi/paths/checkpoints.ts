import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { checkpointMoveResponseSchema, checkpointResponseSchema } from "../schemas/checkpoints";
import { checkpointMovePathParamsSchema, checkpointPathParamsSchema } from "../schemas/paths";
import {
  conflictResponse,
  notFoundResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

export const checkpointPaths = {
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
