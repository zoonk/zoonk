import { betterAuth } from "better-auth/minimal";
import { GUEST_SIGN_IN_RATE_LIMIT } from "./config";
import { createEmailDeletionReauthentication } from "./email-deletion-reauthentication";
import { baseAuthConfig, baseAuthPlugins, fullPlugins, socialProviders } from "./server";

export const auth = betterAuth({
  ...baseAuthConfig,
  plugins: [...baseAuthPlugins, ...fullPlugins],
  rateLimit: {
    customRules: { "/sign-in/anonymous": GUEST_SIGN_IN_RATE_LIMIT },
    enabled: true,
    storage: "database",
  },
  socialProviders,
});

export const reauthorizeEmailForAccountDeletion = createEmailDeletionReauthentication({
  rateLimit: { enabled: true, storage: "database" },
  storeOTP: "hashed",
});
