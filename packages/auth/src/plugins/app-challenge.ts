import { type BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { z } from "zod";
import { issueAppChallenge } from "../request-guards/app-challenge";

/** An auth endpoint, so Better Auth's IP rate limit covers it like every sign-in. */
export function appChallengePlugin() {
  return {
    endpoints: {
      createAppChallenge: createAuthEndpoint(
        "/app-challenge",
        { body: z.object({}).strict(), method: "POST" },
        async (context) => context.json({ challenge: await issueAppChallenge() }),
      ),
    },
    id: "app-challenge",
  } satisfies BetterAuthPlugin;
}
