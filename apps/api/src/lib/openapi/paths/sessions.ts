import { nativeAppleCredentialsSchema } from "@zoonk/auth/native-apple-contract";
import { z } from "zod";
import { accessErrorCodes } from "../../access-error-codes";
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
  description: `Request validation failed, the email code is invalid or expired, or a new account uses a temporary email address. Error codes include: ${sessionErrorCodes.emailCodeInvalid}, ${sessionErrorCodes.emailCodeExpired}, ${sessionErrorCodes.disposableEmail}.`,
} as const;

const signupValidationResponse = {
  ...validationErrorResponse,
  description: `Request validation failed or a new account uses a temporary email address. Error code: ${sessionErrorCodes.disposableEmail}. Existing accounts and supported privacy aliases remain allowed.`,
} as const;

const emailCodeForbiddenResponse = {
  ...forbiddenResponse,
  description: `Account disabled, email code locked, or the request didn't pass BotID. Error codes: ${sessionErrorCodes.accountDisabled}, ${sessionErrorCodes.emailCodeLocked}, ${accessErrorCodes.botDetected}.`,
} as const;

const botCheckForbiddenResponse = {
  ...forbiddenResponse,
  description: `The request didn't pass BotID. Error code: ${accessErrorCodes.botDetected}.`,
} as const;

/**
 * Email codes create accounts, so they need a person behind the request. Vercel BotID only runs
 * in a browser, which native apps can't provide yet.
 */
const EMAIL_CODE_BOT_CHECK = `Requests must pass Vercel BotID, which runs in a browser. Native apps get 403 ${accessErrorCodes.botDetected} in production until the API accepts app attestation (App Attest on iOS, Play Integrity on Android); Sign in with Apple and Google work meanwhile.`;

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
      description: `Emails a sign-in code; signing in with it creates the account the first time. ${EMAIL_CODE_BOT_CHECK}`,
      operationId: "createEmailSignInCode",
      requestBody: {
        content: { "application/json": { schema: emailSignInCodeRequestSchema } },
        required: true,
      },
      responses: {
        "204": { description: "Sign-in code sent" },
        "400": signupValidationResponse,
        "403": botCheckForbiddenResponse,
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
        "400": signupValidationResponse,
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
      description: `Signs in with the code from \`POST /v1/email-sign-in-codes\`, creating the account the first time. ${EMAIL_CODE_BOT_CHECK}`,
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
        "400": signupValidationResponse,
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
