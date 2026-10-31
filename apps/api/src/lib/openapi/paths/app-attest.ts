import { sessionErrorCodes } from "../../session-error-codes";
import {
  appAttestChallengeResponseSchema,
  appAttestKeyRequestBodySchema,
} from "../schemas/app-attest";
import { badRequestResponse } from "../schemas/responses";
import { PUBLIC_SECURITY } from "../security";
import { authRateLimitResponse } from "./sessions";

export const appAttestPaths = {
  "/app-attest/challenges": {
    post: {
      description:
        "A one-time challenge for the apps' bot proof. The iOS app asks for one before attesting its App Attest key and before each request that needs bot proof (`POST /v1/guests`, `POST /v1/email-sign-in-codes`, `POST /v1/sessions/email-code`), where it sends the assertion in the `X-App-Attest-*` headers instead of BotID's browser proof; the Android app asks for one before each of those requests and sends a Play Integrity token in the `X-Play-Integrity-*` headers.",
      operationId: "createAppAttestChallenge",
      responses: {
        "201": {
          content: { "application/json": { schema: appAttestChallengeResponseSchema } },
          description: "Challenge issued",
        },
        "429": authRateLimitResponse,
      },
      security: PUBLIC_SECURITY,
      summary: "Get an app proof challenge",
      tags: ["Sessions"],
    },
  },
  "/app-attest/keys": {
    post: {
      description:
        "Registers a key one install of the iOS app generated and Apple attested over a challenge from `POST /v1/app-attest/challenges`. Register once per install; registering the same key again is a no-op. Keys from App Attest's development environment are refused in production.",
      operationId: "createAppAttestKey",
      requestBody: {
        content: { "application/json": { schema: appAttestKeyRequestBodySchema } },
        required: true,
      },
      responses: {
        "204": { description: "Key registered" },
        "400": {
          ...badRequestResponse,
          description: `Request validation failed, or the attestation is invalid or its challenge was already used or expired. Error code: ${sessionErrorCodes.appAttestationInvalid}.`,
        },
        "429": authRateLimitResponse,
      },
      security: PUBLIC_SECURITY,
      summary: "Register an App Attest key",
      tags: ["Sessions"],
    },
  },
};
