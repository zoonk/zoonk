import { nativeAppleCredentialsSchema } from "@zoonk/auth/native-apple-contract";
import { z } from "zod";
import { sessionErrorCodes } from "../../session-error-codes";
import {
  badRequestResponse,
  forbiddenResponse,
  tooManyRequestsResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "../schemas/responses";
import {
  emailCodeSessionRequestSchema,
  emailSignInCodeRequestSchema,
  googleSessionRequestSchema,
  sessionTokenResponseSchema,
} from "../schemas/sessions";
import { AUTHENTICATED_SECURITY, PUBLIC_SECURITY } from "../security";

const sessionTokenResponse = {
  content: { "application/json": { schema: sessionTokenResponseSchema } },
  description: "Zoonk bearer session created",
} as const;

const accountDisabledResponse = {
  ...forbiddenResponse,
  description: `Account disabled. Error code: ${sessionErrorCodes.accountDisabled}.`,
} as const;

const appleAuthorizationResponse = {
  ...unauthorizedResponse,
  description: `Apple authorization is invalid or expired. Error code: ${sessionErrorCodes.appleAuthorizationInvalid}.`,
} as const;

const emailCodeErrorResponse = {
  ...badRequestResponse,
  description: `Request validation failed, or the email code is invalid or expired. Error codes include: ${sessionErrorCodes.emailCodeInvalid}, ${sessionErrorCodes.emailCodeExpired}.`,
} as const;

const emailCodeForbiddenResponse = {
  ...forbiddenResponse,
  description: `Account disabled or email code locked. Error codes: ${sessionErrorCodes.accountDisabled}, ${sessionErrorCodes.emailCodeLocked}.`,
} as const;

const googleAuthorizationResponse = {
  ...unauthorizedResponse,
  description: `Google authorization is invalid or expired. Error code: ${sessionErrorCodes.googleAuthorizationInvalid}.`,
} as const;

const rateLimitResponse = {
  ...tooManyRequestsResponse,
  description: `Request rate limit exceeded. Error code: ${sessionErrorCodes.rateLimitExceeded}.`,
  headers: z.object({
    "Retry-After": z
      .number()
      .int()
      .nonnegative()
      .meta({ description: "Seconds until another attempt can be made" }),
  }),
} as const;

export const sessionPaths = {
  "/email-sign-in-codes": {
    post: {
      operationId: "createEmailSignInCode",
      requestBody: {
        content: { "application/json": { schema: emailSignInCodeRequestSchema } },
        required: true,
      },
      responses: {
        "204": { description: "Sign-in code sent" },
        "400": validationErrorResponse,
        "403": forbiddenResponse,
        "429": rateLimitResponse,
      },
      security: PUBLIC_SECURITY,
      summary: "Send an email sign-in code",
      tags: ["Sessions"],
    },
  },
  "/sessions/apple": {
    post: {
      operationId: "createAppleSession",
      requestBody: {
        content: { "application/json": { schema: nativeAppleCredentialsSchema } },
        required: true,
      },
      responses: {
        "200": sessionTokenResponse,
        "400": validationErrorResponse,
        "401": appleAuthorizationResponse,
        "403": accountDisabledResponse,
        "429": rateLimitResponse,
      },
      security: PUBLIC_SECURITY,
      summary: "Sign in with Apple",
      tags: ["Sessions"],
    },
  },
  "/sessions/current": {
    delete: {
      description:
        "Deletes the supplied session. Repeating the request after deletion is a 204 no-op.",
      operationId: "deleteCurrentSession",
      responses: {
        "204": { description: "Current session deleted or already absent" },
        "403": forbiddenResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Sign out",
      tags: ["Sessions"],
    },
  },
  "/sessions/email-code": {
    post: {
      operationId: "createEmailCodeSession",
      requestBody: {
        content: { "application/json": { schema: emailCodeSessionRequestSchema } },
        required: true,
      },
      responses: {
        "200": sessionTokenResponse,
        "400": emailCodeErrorResponse,
        "403": emailCodeForbiddenResponse,
        "429": rateLimitResponse,
      },
      security: PUBLIC_SECURITY,
      summary: "Sign in with an email code",
      tags: ["Sessions"],
    },
  },
  "/sessions/google": {
    post: {
      operationId: "createGoogleSession",
      requestBody: {
        content: { "application/json": { schema: googleSessionRequestSchema } },
        required: true,
      },
      responses: {
        "200": sessionTokenResponse,
        "400": validationErrorResponse,
        "401": googleAuthorizationResponse,
        "403": accountDisabledResponse,
        "429": rateLimitResponse,
      },
      security: PUBLIC_SECURITY,
      summary: "Sign in with Google",
      tags: ["Sessions"],
    },
  },
};
