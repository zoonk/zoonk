import { appAttestChallengeResponseSchema } from "../schemas/app-attest";
import { PUBLIC_SECURITY } from "../security";
import { authRateLimitResponse } from "./sessions";

export const appAttestPaths = {
  "/app-attest/challenges": {
    post: {
      description:
        "A one-time challenge for the Android app's restore keys: the Play Integrity proof when registering one, and the WebAuthn challenge when registering or redeeming one (`POST /v1/sessions/current/restore-keys`, `POST /v1/sessions/restore-key`). The path keeps its original name for released apps.",
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
};
