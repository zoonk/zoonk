import { z } from "zod";
import { meResponseSchema, meUpdateSchema } from "../schemas/me";
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
};
