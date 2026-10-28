import { type BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { z } from "zod";
import { issueAppAttestChallenge, registerAppAttestKey } from "../app-attest/app-attest";
import {
  APP_ATTESTATION_INVALID_ERROR_CODE,
  appAttestKeyRequestSchema,
} from "../app-attest/app-attest-contract";

/**
 * App Attest's two steps before an assertion, as auth endpoints so Better Auth's IP rate limit
 * covers them like every sign-in: a one-time challenge, then registering the attested key.
 */
export function appAttestPlugin() {
  return {
    endpoints: {
      createAppAttestChallenge: createAuthEndpoint(
        "/app-attest/challenge",
        { body: z.object({}).strict(), method: "POST" },
        async (context) => context.json({ challenge: await issueAppAttestChallenge() }),
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
