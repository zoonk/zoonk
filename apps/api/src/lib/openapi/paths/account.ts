import { nativeAppleCredentialsSchema } from "@zoonk/auth/native-apple-contract";
import { z } from "zod";
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
  "/auth/sign-in/apple-native": {
    post: {
      operationId: "signInWithNativeApple",
      requestBody: {
        content: { "application/json": { schema: nativeAppleCredentialsSchema } },
        required: true,
      },
      responses: {
        "200": {
          content: { "application/json": { schema: z.object({ token: z.string().min(1) }) } },
          description: "Native Apple authorization exchanged for a Zoonk session",
        },
        "400": badRequestResponse,
        "401": unauthorizedResponse,
        "500": internalErrorResponse,
      },
      security: PUBLIC_SECURITY,
      summary: "Sign in with native Apple authorization",
      tags: ["Account"],
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
};
