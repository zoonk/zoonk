import { betterAuth } from "better-auth/minimal";
import { createEmailDeletionReauthentication } from "./email-deletion-reauthentication";
import { baseAuthConfig, baseAuthPlugins } from "./server";

/** @public */
export const auth = betterAuth({
  ...baseAuthConfig,
  emailAndPassword: {
    enabled: true,
    password: {
      // Use no-op hashing for fast tests (no bcrypt/scrypt overhead)
      hash: async (password) => password,
      verify: async ({ hash, password }) => hash === password,
    },
  },
  plugins: [...baseAuthPlugins],
});

/** @public Vitest aliases the package root to this module, so it must preserve the production entrypoint's deletion capability without requiring Next's cookie context. */
export const reauthorizeEmailForAccountDeletion = createEmailDeletionReauthentication({
  rateLimit: { enabled: false },
  storeOTP: "hashed",
});
