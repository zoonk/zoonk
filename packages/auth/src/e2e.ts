import { betterAuth } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, oneTimeToken } from "better-auth/plugins";
import { sendVerificationOTP } from "./plugins/otp";
import { baseAuthConfig, baseAuthPlugins, fullPlugins, socialProviders } from "./server";
import { stripePlugin } from "./stripe/plugin";

const e2ePluginOverrideIds = new Set(["email-otp", "next-cookies", "one-time-token", "stripe"]);

/**
 * @public
 * E2E-specific auth configuration.
 * - Enables email+password with plain-text matching (no bcrypt overhead)
 * - Disables rate limiting to avoid 429 errors during parallel test runs
 * - Stores OTP and one-time tokens in plain text for E2E testing
 */
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
    stripePlugin({ createCustomerOnSignUp: false }),
    emailOTP({ overrideDefaultEmailVerification: true, sendVerificationOTP, storeOTP: "plain" }),
    oneTimeToken({ storeToken: "plain" }),
    nextCookies(),
  ],
  rateLimit: { enabled: false },
  socialProviders,
});
