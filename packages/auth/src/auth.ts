import { betterAuth } from "better-auth/minimal";
import { createEmailDeletionReauthentication } from "./email-deletion-reauthentication";
import { baseAuthConfig, baseAuthPlugins, fullPlugins, socialProviders } from "./server";

export const auth = betterAuth({
  ...baseAuthConfig,
  plugins: [...baseAuthPlugins, ...fullPlugins],
  rateLimit: { enabled: true, storage: "database" },
  socialProviders,
});

export const reauthorizeEmailForAccountDeletion = createEmailDeletionReauthentication({
  rateLimit: { enabled: true, storage: "database" },
  storeOTP: "hashed",
});
