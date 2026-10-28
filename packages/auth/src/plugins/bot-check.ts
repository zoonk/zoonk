import { isJsonObject } from "@zoonk/utils/json";
import { type AuthContext, type BetterAuthPlugin } from "better-auth";
import { getEndpoints } from "better-auth/api";
import { captcha } from "better-auth/plugins";
import { hasAppAttestAssertion } from "../app-attest/app-attest";
import { getBotIdVerification } from "../request-guards/bot-id";

/**
 * Every auth request that creates a session or emails a sign-in code, without the auth base path.
 * BotID protects anonymous email requests; authenticated native deletion proofs and App Attest
 * assertions are checked separately. Each app's `initBotId` protects main's `/api/auth/*` and the
 * API's `/v1/auth/*`.
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
 * A still-active native bearer can request a deletion proof only for its own account. The
 * authoritative lookup runs Better Auth's bearer hook, without refreshing the stale session or
 * trusting a cached cookie. Sending a code grants no fresh session or deletion authorization.
 */
async function isAuthenticatedEmailCodeRequest({
  context,
  request,
}: {
  context: AuthContext;
  request: Request;
}) {
  const sendPath = `${context.options.basePath ?? "/api/auth"}/email-otp/send-verification-otp`;
  const authorization = request.headers.get("authorization");

  if (
    request.method !== "POST" ||
    new URL(request.url).pathname !== sendPath ||
    !authorization?.toLowerCase().startsWith("bearer ")
  ) {
    return false;
  }

  const body: unknown = await request
    .clone()
    .json()
    .catch(() => null);

  if (!isJsonObject(body) || body.type !== "sign-in" || typeof body.email !== "string") {
    return false;
  }

  const session = await getEndpoints(context, context.options).api.getSession({
    headers: new Headers({ authorization }),
    query: { disableCookieCache: true, disableRefresh: true },
  });

  const user = session?.user;

  return (
    isJsonObject(user) &&
    user.isAnonymous === false &&
    user.banned !== true &&
    user.email.toLowerCase() === body.email.toLowerCase()
  );
}

/**
 * The iOS app can't run BotID, so a genuine copy proves itself with an App Attest assertion on
 * the same requests BotID guards. A missing or failed assertion falls through to BotID, which
 * answers the usual 403.
 */
async function isAppAttestedRequest({
  context,
  request,
}: {
  context: AuthContext;
  request: Request;
}) {
  const basePath = context.options.basePath ?? "/api/auth";
  const { pathname } = new URL(request.url);

  return (
    request.method === "POST" &&
    BOT_CHECKED_AUTH_PATHS.some((path) => pathname === `${basePath}${path}`) &&
    (await hasAppAttestAssertion(request.headers))
  );
}

/**
 * The shared guard accepts local development and E2E without BotID proof. Deployed requests
 * without browser proof fail with 403, except a provider ID token, an existing account's bearer
 * requesting its own email proof, or the iOS app's App Attest assertion.
 */
export function botCheckPlugin() {
  const plugin = captcha({
    checkBotId: getBotIdVerification,
    endpoints: BOT_CHECKED_AUTH_PATHS,
    provider: "vercel-botid",
    validateRequest: async ({ request, verification }) =>
      !verification.isBot || (await isIdTokenSignIn(request)),
  });

  return {
    ...plugin,
    onRequest: async (request, context) => {
      if (
        (await isAuthenticatedEmailCodeRequest({ context, request })) ||
        (await isAppAttestedRequest({ context, request }))
      ) {
        return;
      }

      return plugin.onRequest(request, context);
    },
  } satisfies BetterAuthPlugin;
}
