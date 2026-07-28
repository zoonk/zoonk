import { appendFile } from "node:fs/promises";
import { createAuthMiddleware } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, oneTimeToken } from "better-auth/plugins";
import { sendVerificationOTP } from "./plugins/otp";
import { baseAuthConfig, baseAuthPlugins, fullPlugins, socialProviders } from "./server";
import { stripePlugin } from "./stripe/plugin";

const e2ePluginOverrideIds = new Set(["email-otp", "next-cookies", "one-time-token", "stripe"]);
const SESSION_TRACE_FILE = "e2e/.auth/session-lookups.log";
const SESSION_TRACE_HEADER = "x-e2e-session-trace";

/**
 * Records one Better Auth session endpoint execution for the E2E request that
 * supplied a unique trace identifier. The append-only file lets parallel tests
 * count only their own calls without adding a test route to the API.
 */
async function recordSessionLookup(headers: Headers | undefined) {
  const traceId = headers?.get(SESSION_TRACE_HEADER);

  if (traceId) {
    await appendFile(SESSION_TRACE_FILE, `${traceId}\n`, "utf8");
  }
}

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
  hooks: {
    before: createAuthMiddleware(async (context) => {
      if (context.path === "/get-session") {
        await recordSessionLookup(context.headers ?? context.request?.headers);
      }
    }),
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
