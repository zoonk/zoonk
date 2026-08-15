import { auth } from "@zoonk/auth";
import { prisma } from "@zoonk/db";
import { getString } from "@zoonk/utils/json";
import { callNativeAuthHandler } from "./native-auth-handler";

function getSessionToken(response: unknown) {
  const token = getString(response, "token");

  if (!token) {
    throw new Error("Native sign-in did not create a session");
  }

  return { token };
}

export async function createEmailSignInCode({
  email,
  headers,
  requestURL,
}: {
  email: string;
  headers: Headers;
  requestURL: string;
}) {
  await callNativeAuthHandler({
    body: { email, type: "sign-in" },
    handler: auth.handler,
    headers,
    path: "/email-otp/send-verification-otp",
    requestURL,
  });
}

export async function createEmailCodeSession({
  code,
  email,
  headers,
  requestURL,
}: {
  code: string;
  email: string;
  headers: Headers;
  requestURL: string;
}) {
  const response = await callNativeAuthHandler({
    body: { email, otp: code },
    handler: auth.handler,
    headers,
    path: "/sign-in/email-otp",
    requestURL,
  });

  return getSessionToken(response);
}

export async function createGoogleSession({
  headers,
  idToken,
  requestURL,
}: {
  headers: Headers;
  idToken: string;
  requestURL: string;
}) {
  const response = await callNativeAuthHandler({
    body: { idToken: { token: idToken }, provider: "google" },
    handler: auth.handler,
    headers,
    path: "/sign-in/social",
    requestURL,
  });

  return getSessionToken(response);
}

/**
 * Deletes the authoritative server session before clearing its cookie. Better
 * Auth's sign-out endpoint deliberately swallows persistence failures, which
 * is unsafe for native clients that clear Keychain only after this succeeds.
 */
export async function deleteCurrentSession({ headers }: { headers: Headers }) {
  const currentSession = await auth.api.getSession({
    headers,
    query: { disableCookieCache: true },
  });

  if (currentSession) {
    await prisma.session.deleteMany({ where: { token: currentSession.session.token } });
  }

  const signOut = await auth.api.signOut({ headers, returnHeaders: true });
  return { headers: signOut.headers };
}
