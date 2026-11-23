import {
  mockScheduleChangeSchema,
  mockScheduleInputSchema,
  mockScheduleOptionsSchema,
} from "@zoonk/core/checkpoints/mock-schedule-contract";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { challengeMovePathParamsSchema, challengePathParamsSchema } from "../schemas/paths";
import {
  conflictResponse,
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

const scheduleResponses = {
  "400": validationErrorResponse,
  "401": unauthorizedResponse,
  "404": notFoundResponse,
  "409": conflictResponse,
};
export const mockSchedulePaths = {
  "/challenges/{planItemId}/schedule": {
    get: {
      description:
        "The available study days after this mock and before the next mock or exam. An empty list permits skipping only.",
      operationId: "getMockScheduleDates",
      requestParams: { path: challengePathParamsSchema, query: studySessionTimeZoneInputSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: mockScheduleOptionsSchema } },
          description: "Available study days",
        },
        ...scheduleResponses,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get dates for rescheduling a mock",
      tags: ["Study sessions"],
    },
    post: {
      description:
        "Moves one unstarted mock to a chosen study day or skips that occurrence. The original plan item ID and the change ID identify the undo.",
      operationId: "changeMockSchedule",
      requestBody: {
        content: { "application/json": { schema: mockScheduleInputSchema } },
        required: true,
      },
      requestParams: { path: challengePathParamsSchema },
      responses: {
        "200": {
          content: { "application/json": { schema: mockScheduleChangeSchema } },
          description: "The saved change and its plan item",
        },
        ...scheduleResponses,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Reschedule or skip a scheduled mock",
      tags: ["Study sessions"],
    },
  },
  "/challenges/{planItemId}/schedule/{changeId}": {
    delete: {
      description: "Restores the mock and its plan while the schedule change can still be undone.",
      operationId: "undoMockSchedule",
      requestParams: {
        path: challengeMovePathParamsSchema,
        query: studySessionTimeZoneInputSchema,
      },
      responses: {
        "204": { description: "The mock is back on its previous day" },
        ...scheduleResponses,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Undo a mock schedule change",
      tags: ["Study sessions"],
    },
  },
};
