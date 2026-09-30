import { isJsonObject } from "@zoonk/utils/json";
import { captcha } from "better-auth/plugins";
import { checkBotId } from "botid/server";

/**
 * Every auth request that creates a session or emails a sign-in code, without the auth base path.
 * BotID must pass first. Each app's `initBotId` protects the same requests in the browser: main's
 * `/api/auth/*` and the API's `/v1/auth/*`.
 */
const BOT_CHECKED_AUTH_PATHS = [
  "/email-otp/send-verification-otp",
  "/sign-in/anonymous",
  "/sign-in/email-otp",
  "/sign-in/social",
];

/**
 * Native apps sign in with the provider's ID token instead of a browser redirect, so BotID can't
 * run there; the provider's token vouches for the account instead.
 */
async function isIdTokenSignIn(request: Request): Promise<boolean> {
  if (!new URL(request.url).pathname.endsWith("/sign-in/social")) {
    return false;
  }

  const body: unknown = await request
    .clone()
    .json()
    .catch(() => null);

  return isJsonObject(body) && body.idToken !== undefined;
}

/**
 * Vercel BotID on the auth requests above, through Better Auth's captcha plugin. BotID treats
 * local development as a person; E2E runs a production build outside Vercel, so its auth instance
 * leaves this plugin out. Requests without BotID's browser proof fail with 403, which is how
 * native apps' guest and email-code sign-ins fail closed until they can attest instead.
 */
export function botCheckPlugin() {
  return captcha({
    checkBotId,
    endpoints: BOT_CHECKED_AUTH_PATHS,
    provider: "vercel-botid",
    validateRequest: async ({ request, verification }) =>
      !verification.isBot || (await isIdTokenSignIn(request)),
  });
}
