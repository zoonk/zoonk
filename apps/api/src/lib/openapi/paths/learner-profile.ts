import { birthYearInputSchema, learningProfileUpdateSchema } from "@zoonk/core/profile/contract";
import { accessErrorCodes } from "../../access-error-codes";
import { allowanceResponseSchema } from "../schemas/allowance";
import { dailyTimeLimitResponseSchema } from "../schemas/daily-time-limit";
import { learningProfileResponseSchema } from "../schemas/learning-profile";
import {
  notFoundResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY, PUBLIC_SECURITY } from "../security";

const birthYearRefusalResponse = {
  ...unprocessableEntityResponse,
  description: `Below the minimum age (\`${accessErrorCodes.belowMinimumAge}\` with \`details.minimumAge\`), or a year in the future or older than anyone alive (\`${accessErrorCodes.invalidBirthYear}\`).`,
};

export const learnerProfilePaths = {
  "/age-checks": {
    post: {
      description:
        "Before a visitor's first write starts a guest, so nobody below the minimum age where the request comes from gets an account. Saves nothing; save the year with `PUT /v1/me/birth-year` once the guest exists.",
      operationId: "checkBirthYear",
      requestBody: {
        content: { "application/json": { schema: birthYearInputSchema } },
        required: true,
      },
      responses: {
        "204": { description: "Old enough to start" },
        "400": validationErrorResponse,
        "422": birthYearRefusalResponse,
      },
      security: PUBLIC_SECURITY,
      summary: "Check a birth year before starting",
      tags: ["Account"],
    },
  },
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
  "/me/birth-year": {
    put: {
      description:
        "Asked once, before a guest or learner keeps learning; a saved year stays. Below the minimum age where the request comes from, nothing is saved and the client ends the session. A visitor's year goes through `POST /v1/age-checks` first.",
      operationId: "saveCurrentUserBirthYear",
      requestBody: {
        content: { "application/json": { schema: birthYearInputSchema } },
        required: true,
      },
      responses: {
        "200": {
          content: { "application/json": { schema: learningProfileResponseSchema } },
          description: "The learning profile with the saved birth year",
        },
        "400": validationErrorResponse,
        "401": unauthorizedResponse,
        "422": birthYearRefusalResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Save current user's birth year",
      tags: ["Account"],
    },
  },
  "/me/daily-time-limit": {
    get: {
      operationId: "getCurrentUserDailyTimeLimit",
      responses: {
        "200": {
          content: { "application/json": { schema: dailyTimeLimitResponseSchema } },
          description: "Minutes studied today and the learner's daily limit, if any",
        },
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get current user's daily time limit",
      tags: ["Account"],
    },
  },
  "/me/learning-profile": {
    get: {
      operationId: "getCurrentUserLearningProfile",
      responses: {
        "200": {
          content: { "application/json": { schema: learningProfileResponseSchema } },
          description: "Buddy, settings and active goal",
        },
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get current user's learning profile",
      tags: ["Account"],
    },
    patch: {
      description: "Send only the fields that changed.",
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
        "404": {
          ...notFoundResponse,
          description: `The active goal isn't one of the learner's goals. Error code: ${accessErrorCodes.goalNotFound}.`,
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
