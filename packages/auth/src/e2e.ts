import { betterAuth } from "better-auth/minimal";
import {
  baseAuthConfig,
  baseAuthPlugins,
  fullPlugins,
  socialProviders,
} from "./config";

/**
 * E2E-specific auth configuration.
 * - Enables email+password with plain-text matching (no bcrypt overhead)
 * - Disables rate limiting to avoid 429 errors during parallel test runs
 */
export const auth = betterAuth({
  ...baseAuthConfig,
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password: string) => password,
      verify: async ({ hash, password }: { hash: string; password: string }) =>
        hash === password,
    },
  },
  plugins: [...baseAuthPlugins, ...fullPlugins],
  rateLimit: { enabled: false },
  socialProviders,
});
