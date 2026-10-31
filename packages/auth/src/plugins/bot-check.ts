import { isJsonObject } from "@zoonk/utils/json";
import { type AuthContext, type BetterAuthPlugin } from "better-auth";
import { getEndpoints } from "better-auth/api";
import { captcha } from "better-auth/plugins";
import { hasAppAttestAssertion } from "../app-attest/app-attest";
import {
  APP_ATTEST_HEADERS,
  APP_ATTEST_OPERATIONS,
  type AppAttestBinding,
} from "../app-attest/app-attest-contract";
import { hasPlayIntegrityProof } from "../play-integrity/play-integrity";
import { PLAY_INTEGRITY_HEADERS } from "../play-integrity/play-integrity-contract";
import { getBotIdVerification } from "../request-guards/bot-id";

/** Each app's `initBotId` must cover these: main's `/api/auth/*` and the API's `/v1/auth/*`. */
const BOT_CHECKED_AUTH_PATHS = [
  "/email-otp/send-verification-otp",
  "/sign-in/anonymous",
  "/sign-in/email-otp",
  "/sign-in/social",
];

/** BotID can't run in the native apps, so the provider's ID token vouches for the account instead. */
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
 * A still-active native bearer may request a deletion code only for its own account. Sending a code
 * grants no session or deletion authorization.
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

async function readAppProofBinding(
  path: string,
  request: Request,
): Promise<AppAttestBinding | null> {
  if (path === "/sign-in/anonymous") {
    return { fields: [], operation: APP_ATTEST_OPERATIONS.guest };
  }

  const body: unknown = await request
    .clone()
    .json()
    .catch(() => null);

  if (!isJsonObject(body) || typeof body.email !== "string") {
    return null;
  }

  if (path === "/email-otp/send-verification-otp" && body.type === "sign-in") {
    return { fields: [body.email], operation: APP_ATTEST_OPERATIONS.emailCode };
  }

  if (path === "/sign-in/email-otp" && typeof body.otp === "string") {
    return { fields: [body.email, body.otp], operation: APP_ATTEST_OPERATIONS.emailSession };
  }

  return null;
}

/** A missing or failed proof falls through to BotID, which answers the usual 403. */
async function isAppProvenRequest({
  context,
  request,
}: {
  context: AuthContext;
  request: Request;
}) {
  const basePath = context.options.basePath ?? "/api/auth";
  const { pathname } = new URL(request.url);
  const path = BOT_CHECKED_AUTH_PATHS.find((checked) => pathname === `${basePath}${checked}`);

  const { headers } = request;
  const isAppAttest = headers.has(APP_ATTEST_HEADERS.keyId);

  if (
    request.method !== "POST" ||
    !path ||
    (!isAppAttest && !headers.has(PLAY_INTEGRITY_HEADERS.token))
  ) {
    return false;
  }

  const binding = await readAppProofBinding(path, request);

  if (!binding) {
    return false;
  }

  return isAppAttest
    ? hasAppAttestAssertion({ binding, headers })
    : hasPlayIntegrityProof({ binding, headers });
}

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
        (await isAppProvenRequest({ context, request }))
      ) {
        return;
      }

      return plugin.onRequest(request, context);
    },
  } satisfies BetterAuthPlugin;
}
