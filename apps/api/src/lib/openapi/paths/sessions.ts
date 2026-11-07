import { nativeAppleCredentialsSchema } from "@zoonk/auth/native-apple-contract";
import { RESTORE_KEY_RP_ID } from "@zoonk/auth/restore-key-contract";
import { z } from "zod";
import { accessErrorCodes } from "../../access-error-codes";
import { sessionErrorCodes } from "../../session-error-codes";
import { appProofHeaderParamsSchema } from "../schemas/app-attest";
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
  restoreKeyRequestBodySchema,
  restoreKeySessionRequestBodySchema,
  restoreKeySessionResponseSchema,
  sessionTokenResponseSchema,
} from "../schemas/sessions";
import { AUTHENTICATED_SECURITY, OPTIONAL_BEARER_SECURITY, PUBLIC_SECURITY } from "../security";

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
  description: `Account disabled, email code locked, or the request had no bot proof (BotID's, App Attest's or Play Integrity's). Error codes: ${sessionErrorCodes.accountDisabled}, ${sessionErrorCodes.emailCodeLocked}, ${accessErrorCodes.botDetected}.`,
} as const;

const botCheckForbiddenResponse = {
  ...forbiddenResponse,
  description: `The request had no bot proof (BotID's, App Attest's or Play Integrity's), or it has browser fetch metadata (Sec-Fetch-*) without an Origin Zoonk trusts. Error codes: ${accessErrorCodes.botDetected}, ${accessErrorCodes.untrustedOrigin}.`,
} as const;

const EMAIL_CODE_BOT_CHECK = `Requests must pass Vercel BotID, which runs in a browser, or carry the iOS app's App Attest assertion in the \`X-App-Attest-*\` headers or the Android app's Play Integrity token in the \`X-Play-Integrity-*\` headers (see \`POST /v1/app-attest/challenges\`); without any of them they get 403 ${accessErrorCodes.botDetected}.`;

const googleAuthorizationResponse = {
  ...unauthorizedResponse,
  description: `Google authorization is invalid or expired. Error code: ${sessionErrorCodes.googleAuthorizationInvalid}.`,
} as const;

const RESTORE_KEY_CHALLENGE = `Make the key's WebAuthn request over a fresh challenge from \`POST /v1/app-attest/challenges\`, with the RP ID \`${RESTORE_KEY_RP_ID}\`.`;

const restoreKeyChallengeResponse = {
  ...badRequestResponse,
  description: `Request validation failed, the challenge wasn't issued here or was already used or expired, or the JSON isn't a credential response. Keep the key and try again with a new challenge. Error codes include: ${sessionErrorCodes.restoreKeyChallengeInvalid}, ${sessionErrorCodes.restoreKeyResponseMalformed}.`,
} as const;

export const authRateLimitResponse = {
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
      description: `Emails a sign-in code; signing in with it creates the account the first time. An optional existing bearer session, even one too old to delete the account directly, authorizes delivery only to that account's email without BotID. The session must still be active; guests and disabled accounts are excluded. This does not refresh the session or authorize deletion: submit the emailed code to DELETE /v1/me. All sends retain Better Auth's IP rate limit. ${EMAIL_CODE_BOT_CHECK}`,
      operationId: "createEmailSignInCode",
      requestBody: {
        content: { "application/json": { schema: emailSignInCodeRequestSchema } },
        required: true,
      },
      requestParams: { header: appProofHeaderParamsSchema },
      responses: {
        "204": { description: "Sign-in code sent" },
        "400": signupValidationResponse,
        "403": botCheckForbiddenResponse,
        "429": authRateLimitResponse,
      },
      security: OPTIONAL_BEARER_SECURITY,
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
        "429": authRateLimitResponse,
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
  "/sessions/current/restore-keys": {
    post: {
      description: `Registers the restore key the Android app made with Credential Manager's Restore Credentials after this session signed in, so the learner's next phone signs in with \`POST /v1/sessions/restore-key\`. ${RESTORE_KEY_CHALLENGE} Use ES256 or RS256, attestation \`none\` and a discoverable credential; user verification isn't required. The key signs in only while this session lasts: signing out, deleting the account or a guest creating an account ends it on every phone. Registering the same key again for this session is a no-op.`,
      operationId: "createRestoreKey",
      requestBody: {
        content: { "application/json": { schema: restoreKeyRequestBodySchema } },
        required: true,
      },
      responses: {
        "204": { description: "Restore key registered, or already registered for this session" },
        "400": {
          ...badRequestResponse,
          description: `Request validation failed, the challenge wasn't issued here or was already used or expired, or the registration is malformed, doesn't verify (origin, RP ID, algorithm) or names a key another session registered. Error codes include: ${sessionErrorCodes.restoreKeyChallengeInvalid}, ${sessionErrorCodes.restoreKeyResponseMalformed}, ${sessionErrorCodes.restoreKeyRegistrationInvalid}.`,
        },
        "401": unauthorizedResponse,
        "429": authRateLimitResponse,
      },
      security: AUTHENTICATED_SECURITY,
      summary: "Register a restore key",
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
      requestParams: { header: appProofHeaderParamsSchema },
      responses: {
        "200": sessionTokenResponse,
        "400": emailCodeErrorResponse,
        "403": emailCodeForbiddenResponse,
        "429": authRateLimitResponse,
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
        "429": authRateLimitResponse,
      },
      security: PUBLIC_SECURITY,
      summary: "Sign in with Google",
      tags: ["Sessions"],
    },
  },
  "/sessions/restore-key": {
    post: {
      description: `Signs a new phone in with the restore key Google moved to it from the learner's previous phone, creating a new session for that learner, guests included. The previous phone keeps its own session, and this key signs in only while that session lasts, so register a new key for the new session with \`POST /v1/sessions/current/restore-keys\`. ${RESTORE_KEY_CHALLENGE} No bot proof is needed: the key's signature is the proof.`,
      operationId: "createRestoreKeySession",
      requestBody: {
        content: { "application/json": { schema: restoreKeySessionRequestBodySchema } },
        required: true,
      },
      responses: {
        "200": {
          content: { "application/json": { schema: restoreKeySessionResponseSchema } },
          description: "Zoonk bearer session created for the key's learner",
        },
        "400": restoreKeyChallengeResponse,
        "401": {
          ...unauthorizedResponse,
          description: `This restore key can't sign in: it's unknown, its signature, origin or RP ID is wrong, or the session that registered it ended. Delete the key. Error code: ${sessionErrorCodes.restoreKeyInvalid}.`,
        },
        "403": accountDisabledResponse,
        "429": authRateLimitResponse,
      },
      security: PUBLIC_SECURITY,
      summary: "Sign in with a restore key",
      tags: ["Sessions"],
    },
  },
};
