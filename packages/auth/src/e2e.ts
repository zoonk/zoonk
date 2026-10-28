import { betterAuth } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import { oneTimeToken } from "better-auth/plugins";
import { GUEST_SIGN_IN_RATE_LIMIT } from "./config";
import { createEmailDeletionReauthentication } from "./email-deletion-reauthentication";
import { createEmailOTPPlugin } from "./email-otp-plugin";
import { sessionHintPlugin } from "./plugins/session-hint";
import { baseAuthConfig, baseAuthPlugins, fullPlugins, socialProviders } from "./server";

/** BotID (the `captcha` plugin) only answers on Vercel, so the E2E build, which runs outside it, leaves it out. */
const e2ePluginOverrideIds = new Set([
  "captcha",
  "email-otp",
  "next-cookies",
  "one-time-token",
  "session-hint",
]);

export const auth = betterAuth({
  ...baseAuthConfig,
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password: string) => password,
      verify: async ({ hash, password }: { hash: string; password: string }) => hash === password,
    },
  },
  plugins: [
    ...baseAuthPlugins,
    ...fullPlugins.filter((plugin) => !e2ePluginOverrideIds.has(plugin.id)),
    createEmailOTPPlugin({ storeOTP: "plain" }),
    oneTimeToken({ storeToken: "plain" }),
    sessionHintPlugin(),
    nextCookies(),
  ],
  rateLimit: {
    // eslint-disable-next-line sort-keys -- Better Auth uses the first matching rule; the catch-all must stay last.
    customRules: {
      "/sign-in/anonymous": (request) =>
        request.headers.get("x-e2e-auth-rate-limit") === "true" ? GUEST_SIGN_IN_RATE_LIMIT : false,
      "/**": false,
    },
    enabled: true,
    storage: "database",
  },
  socialProviders,
});

/** Next's E2E alias replaces the package root with this module, so it mirrors the production export. */
export const reauthorizeEmailForAccountDeletion = createEmailDeletionReauthentication({
  rateLimit: { enabled: false },
  storeOTP: "plain",
});
