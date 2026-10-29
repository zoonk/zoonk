import { type BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { z } from "zod";
import { registerAppAttestKey } from "../app-attest/app-attest";
import {
  APP_ATTESTATION_INVALID_ERROR_CODE,
  appAttestKeyRequestSchema,
} from "../app-attest/app-attest-contract";
import { issueAppChallenge } from "../request-guards/app-challenge";

/** Auth endpoints, so Better Auth's IP rate limit covers them like every sign-in. */
export function appAttestPlugin() {
  return {
    endpoints: {
      createAppAttestChallenge: createAuthEndpoint(
        "/app-attest/challenge",
        { body: z.object({}).strict(), method: "POST" },
        async (context) => context.json({ challenge: await issueAppChallenge() }),
      ),
      createAppAttestKey: createAuthEndpoint(
        "/app-attest/key",
        { body: appAttestKeyRequestSchema, method: "POST" },
        async (context) => {
          if (!(await registerAppAttestKey(context.body))) {
            throw new APIError("BAD_REQUEST", {
              code: APP_ATTESTATION_INVALID_ERROR_CODE,
              message: "This app attestation is invalid or its challenge expired",
            });
          }

          return context.json({ registered: true });
        },
      ),
    },
    id: "app-attest",
  } satisfies BetterAuthPlugin;
}
