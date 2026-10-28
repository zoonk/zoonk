import { betterAuth } from "better-auth/minimal";
import { createEmailDeletionReauthentication } from "./email-deletion-reauthentication";
import { baseAuthConfig, baseAuthPlugins } from "./server";

export const auth = betterAuth({
  ...baseAuthConfig,
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password) => password,
      verify: async ({ hash, password }) => hash === password,
    },
  },
  plugins: [...baseAuthPlugins],
});

/** Vitest aliases the package root to this module, so it mirrors the production export without Next's cookie context. */
export const reauthorizeEmailForAccountDeletion = createEmailDeletionReauthentication({
  rateLimit: { enabled: false },
  storeOTP: "hashed",
});
