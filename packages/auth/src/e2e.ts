import { appendFile } from "node:fs/promises";
import { createAuthMiddleware } from "better-auth/api";
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
 * E2E-specific auth configuration.
 * - Enables email+password with plain-text matching (no bcrypt overhead)
 * - Bypasses rate limiting except guest requests opting into real limiter coverage
 * - Stores OTP and one-time tokens in plain text for E2E testing
 * - Mints one-time tokens over HTTP (off in production), so fixtures can sign a learner in on any app
 */
export const auth = betterAuth({
  ...baseAuthConfig,
  disabledPaths: baseAuthConfig.disabledPaths?.filter(
    (path) => path !== "/one-time-token/generate",
  ),
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password: string) => password,
      verify: async ({ hash, password }: { hash: string; password: string }) => hash === password,
    },
  },
  hooks: {
    before: createAuthMiddleware(async (context) => {
      await baseAuthConfig.hooks?.before?.(context);

      if (context.path === "/get-session") {
        await recordSessionLookup(context.headers ?? context.request?.headers);
      }
    }),
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

/** Next's E2E alias replaces the package root with this module, so it must expose the same server capabilities as the production entrypoint while using test-safe OTP storage. */
export const reauthorizeEmailForAccountDeletion = createEmailDeletionReauthentication({
  rateLimit: { enabled: false },
  storeOTP: "plain",
});
