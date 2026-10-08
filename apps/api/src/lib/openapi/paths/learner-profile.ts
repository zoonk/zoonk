import { learningProfileUpdateSchema } from "@zoonk/core/profile/contract";
import { accessErrorCodes } from "../../access-error-codes";
import { allowanceResponseSchema } from "../schemas/allowance";
import { dailyTimeLimitResponseSchema } from "../schemas/guardians";
import { learningProfileResponseSchema } from "../schemas/learning-profile";
import {
  conflictResponse,
  forbiddenResponse,
  notFoundResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY } from "../security";

export const learnerProfilePaths = {
  "/me/allowance": {
    get: {
      description:
        "Guests and learners see their plan's allowance. New lessons started count, reused or generated; quick explanations and reviews don't.",
      operationId: "getCurrentUserAllowance",
      responses: {
        "200": {
          content: { "application/json": { schema: allowanceResponseSchema } },
          description: "Plan, usage and reset times",
        },
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get current user's allowance",
      tags: ["Account"],
    },
  },
  "/me/daily-time-limit": {
    get: {
      operationId: "getCurrentUserDailyTimeLimit",
      responses: {
        "200": {
          content: { "application/json": { schema: dailyTimeLimitResponseSchema } },
          description: "Minutes studied today and the guardian limit, if any",
        },
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get current user's daily time limit",
      tags: ["Guardians"],
    },
  },
  "/me/learning-profile": {
    get: {
      operationId: "getCurrentUserLearningProfile",
      responses: {
        "200": {
          content: { "application/json": { schema: learningProfileResponseSchema } },
          description: "Buddy, age answer, settings, active goal and the protections they imply",
        },
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get current user's learning profile",
      tags: ["Account"],
    },
    patch: {
      description:
        "Send only the fields that changed. A birth month and year under 13 deletes the account. Once given, the birth month and year can only be corrected toward younger; support corrects an answer that makes the learner older.",
      operationId: "updateCurrentUserLearningProfile",
      requestBody: {
        content: { "application/json": { schema: learningProfileUpdateSchema } },
        required: true,
      },
      responses: {
        "200": {
          content: { "application/json": { schema: learningProfileResponseSchema } },
          description: "Updated learning profile",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "403": {
          ...forbiddenResponse,
          description: `The age answer is under 13, so the account and its data were deleted; sign out. Error code: ${accessErrorCodes.underMinimumAge}.`,
        },
        "404": {
          ...notFoundResponse,
          description: `The active goal isn't one of the learner's goals. Error code: ${accessErrorCodes.goalNotFound}.`,
        },
        "409": {
          ...conflictResponse,
          description: `The new birth month and year make the learner older than the saved answer, which only support can change. Error code: ${accessErrorCodes.birthChangeNeedsSupport}.`,
        },
        "422": {
          ...unprocessableEntityResponse,
          description: `The buddy's glasses haven't been earned. Error code: ${accessErrorCodes.glassesNotEarned}.`,
        },
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Update current user's learning profile",
      tags: ["Account"],
    },
  },
};
