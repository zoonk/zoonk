import { z } from "zod";
import { accountDataExportSchema } from "../schemas/account-export";
import {
  meDeletionResponseSchema,
  meDeletionSchema,
  meResponseSchema,
  meUpdateSchema,
} from "../schemas/me";
import {
  badRequestResponse,
  conflictResponse,
  forbiddenResponse,
  internalErrorResponse,
  unauthorizedResponse,
} from "../schemas/responses";
import { AUTHENTICATED_SECURITY, PUBLIC_SECURITY } from "../security";

export const accountPaths = {
  "/auth/health": {
    get: {
      operationId: "getAuthHealth",
      responses: {
        "200": {
          content: { "application/json": { schema: z.object({ status: z.literal("ok") }) } },
          description: "Service is healthy",
        },
      },
      security: PUBLIC_SECURITY,
      summary: "Health check",
      tags: ["Health"],
    },
  },
  "/me": {
    delete: {
      operationId: "deleteCurrentUser",
      requestBody: {
        content: { "application/json": { schema: meDeletionSchema } },
        required: true,
      },
      responses: {
        "200": {
          content: { "application/json": { schema: meDeletionResponseSchema } },
          description: "Account deleted with provider revocation outcome",
        },
        "400": badRequestResponse,
        "401": unauthorizedResponse,
        "403": forbiddenResponse,
        "500": internalErrorResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Delete current user's account",
      tags: ["Account"],
    },
    get: {
      operationId: "getCurrentUser",
      responses: {
        "200": {
          content: { "application/json": { schema: meResponseSchema } },
          description: "Current user and account state",
        },
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Get current user",
      tags: ["Account"],
    },
    patch: {
      operationId: "updateCurrentUser",
      requestBody: { content: { "application/json": { schema: meUpdateSchema } }, required: true },
      responses: {
        "200": {
          content: { "application/json": { schema: meResponseSchema } },
          description: "Updated user and account state",
        },
        "400": badRequestResponse,
        "401": unauthorizedResponse,
        "403": forbiddenResponse,
        "409": conflictResponse,
        "500": internalErrorResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Update current user",
      tags: ["Account"],
    },
  },
  "/me/export": {
    get: {
      description:
        "Everything Zoonk keeps about the learner as one JSON download: the account, learning profile, goals and plans, the progress ledger, answers, skills, mistakes, milestones, memory, feedback and guardian links.",
      operationId: "exportCurrentUserData",
      responses: {
        "200": {
          content: { "application/json": { schema: accountDataExportSchema } },
          description: "The learner's data, sent as an attachment",
        },
        "401": unauthorizedResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Export the current user's data",
      tags: ["Account"],
    },
  },
};
