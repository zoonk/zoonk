import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  sessionMiddleware,
} from "better-auth/api";
import { z } from "zod";

export function trustedOriginPlugin() {
  return {
    endpoints: {
      validateTrustedOrigin: createAuthEndpoint(
        "/trusted-origin/validate",
        {
          body: z.object({ url: z.string().url() }),
          method: "POST",
          use: [sessionMiddleware],
        },
        async (ctx) => {
          const { url } = ctx.body;

          const isTrusted = ctx.context.isTrustedOrigin(url, {
            allowRelativePaths: false,
          });

          if (!isTrusted) {
            throw new APIError("FORBIDDEN", { message: "UNTRUSTED_ORIGIN" });
          }

          return ctx.json({ trusted: true });
        },
      ),
    },
    id: "trusted-origin",
  } satisfies BetterAuthPlugin;
}
