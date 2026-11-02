import { betterAuth } from "better-auth/minimal";
import { SHARED_IP_SIGN_IN_RATE_LIMIT } from "./config";
import { createEmailDeletionReauthentication } from "./email-deletion-reauthentication";
import {
  baseAuthConfig,
  baseAuthPlugins,
  fullPlugins,
  signInDatabaseHooks,
  socialProviders,
} from "./server";

export const auth = betterAuth({
  ...baseAuthConfig,
  databaseHooks: signInDatabaseHooks,
  plugins: [...baseAuthPlugins, ...fullPlugins],
  rateLimit: {
    customRules: {
      "/email-otp/send-verification-otp": SHARED_IP_SIGN_IN_RATE_LIMIT,
      "/sign-in/anonymous": SHARED_IP_SIGN_IN_RATE_LIMIT,
      "/sign-in/email-otp": SHARED_IP_SIGN_IN_RATE_LIMIT,
    },
    enabled: true,
    storage: "database",
  },
  socialProviders,
});

export const reauthorizeEmailForAccountDeletion = createEmailDeletionReauthentication({
  rateLimit: { enabled: true, storage: "database" },
  storeOTP: "hashed",
});
