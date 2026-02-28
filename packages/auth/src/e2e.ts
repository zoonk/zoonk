import { betterAuth } from "better-auth/minimal";
import { emailOTP, oneTimeToken } from "better-auth/plugins";
import { baseAuthConfig, baseAuthPlugins, fullPlugins, socialProviders } from "./config";
import { sendVerificationOTP } from "./plugins/otp";

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
    ...fullPlugins.filter((plugin) => plugin.id !== "email-otp" && plugin.id !== "one-time-token"),
    emailOTP({
      overrideDefaultEmailVerification: true,
      sendVerificationOTP,
      storeOTP: "plain",
    }),
    oneTimeToken({
      storeToken: "plain",
    }),
  ],
  rateLimit: { enabled: false },
  socialProviders,
});
