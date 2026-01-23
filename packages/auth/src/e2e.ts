import { betterAuth } from "better-auth/minimal";
import { emailOTP } from "better-auth/plugins";
import { baseAuthConfig, baseAuthPlugins, fullPlugins, socialProviders } from "./config";
import { sendVerificationOTP } from "./plugins/otp";

/**
 * E2E-specific auth configuration.
 * - Enables email+password with plain-text matching (no bcrypt overhead)
 * - Disables rate limiting to avoid 429 errors during parallel test runs
 * - Stores OTP in plain text for E2E testing (allows DB queries to verify OTP)
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
    ...fullPlugins.filter((p) => p.id !== "email-otp"),
    emailOTP({
      overrideDefaultEmailVerification: true,
      sendVerificationOTP,
      storeOTP: "plain",
    }),
  ],
  rateLimit: { enabled: false },
  socialProviders,
});
