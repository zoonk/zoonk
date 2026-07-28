import { errorSchema } from "./common";

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
  description: "Same-origin request required for cookie authentication",
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

export const unprocessableEntityResponse = {
  content: { "application/json": { schema: errorSchema } },
  description: "The request is valid but cannot be applied to the resource",
} as const;
