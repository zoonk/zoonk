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
        "A one-time challenge for app attestation and restore keys. The iOS app uses it to attest its App Attest key. The Android app uses it for Play Integrity proof when registering a restore key, and as the WebAuthn challenge when registering or redeeming a restore key (`POST /v1/sessions/current/restore-keys`, `POST /v1/sessions/restore-key`).",
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
