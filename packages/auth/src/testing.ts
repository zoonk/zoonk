import { betterAuth } from "better-auth/minimal";
import { bearer } from "better-auth/plugins";
import { createEmailDeletionReauthentication } from "./email-deletion-reauthentication";
import { cliLoginPlugins } from "./plugins/cli-login";
import { baseAuthConfig, baseAuthPlugins, signInDatabaseHooks } from "./server";

export const auth = betterAuth({
  ...baseAuthConfig,
  databaseHooks: signInDatabaseHooks,
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password) => password,
      verify: async ({ hash, password }) => hash === password,
    },
  },
  plugins: [...baseAuthPlugins, bearer(), ...cliLoginPlugins],
});

/** Vitest aliases the package root to this module, so it mirrors the production export without Next's cookie context. */
export const reauthorizeEmailForAccountDeletion = createEmailDeletionReauthentication({
  rateLimit: { enabled: false },
  storeOTP: "hashed",
});
