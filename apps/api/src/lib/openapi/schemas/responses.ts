import { type z } from "zod";
import { errorSchema } from "./common";

export function jsonResponse<TSchema extends z.ZodType>(schema: TSchema, description: string) {
  return { content: { "application/json": { schema } }, description };
}

export const validationErrorResponse = {
  content: { "application/json": { schema: errorSchema } },
  description: "Validation error",
} as const;

export const badRequestResponse = {
  content: { "application/json": { schema: errorSchema } },
  description: "Bad request",
} as const;

export const conflictResponse = {
  content: { "application/json": { schema: errorSchema } },
  description: "Conflict",
} as const;

export const unauthorizedResponse = {
  content: { "application/json": { schema: errorSchema } },
  description: "Authentication required",
} as const;

export const forbiddenResponse = {
  content: { "application/json": { schema: errorSchema } },
  description: "Request forbidden",
} as const;

export const internalErrorResponse = {
  content: { "application/json": { schema: errorSchema } },
  description: "Internal server error",
} as const;

export const notFoundResponse = {
  content: { "application/json": { schema: errorSchema } },
  description: "Resource not found",
} as const;

export const paymentRequiredResponse = {
  content: { "application/json": { schema: errorSchema } },
  description: "Subscription required",
} as const;

export const tooManyRequestsResponse = {
  content: { "application/json": { schema: errorSchema } },
  description: "Too many requests",
} as const;

export const unprocessableEntityResponse = {
  content: { "application/json": { schema: errorSchema } },
  description: "The request is valid but cannot be applied to the resource",
} as const;

export const guestRefusalResponse = {
  ...forbiddenResponse,
  description:
    "A guest is asked to create a free account, where their work moves: their own cap is used (`USAGE_LIMIT_REACHED` with `details.limit`), or the day's AI budget all guests share is spent (`SIGN_UP_REQUIRED`)",
} as const;

export const smallAiHelpRefusalResponses = {
  "402": {
    ...paymentRequiredResponse,
    description: "A free learner reached today's AI budget (`USAGE_LIMIT_REACHED`)",
  },
  "403": guestRefusalResponse,
  "429": {
    ...tooManyRequestsResponse,
    description:
      "`SLOW_DOWN`: try again after `Retry-After`; or a Plus learner reached today's AI budget (`USAGE_LIMIT_REACHED`), back tomorrow",
  },
} as const;
