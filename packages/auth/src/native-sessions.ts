import { auth } from "@zoonk/auth";
import { prisma } from "@zoonk/db";
import { getString, isJsonObject } from "@zoonk/utils/json";
import { callNativeAuthHandler, sendNativeAuthRequest } from "./native-auth-handler";

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

export async function createGuestSession({
  headers,
  requestURL,
}: {
  headers: Headers;
  requestURL: string;
}) {
  const response = await callNativeAuthHandler({
    body: {},
    handler: auth.handler,
    headers,
    path: "/sign-in/anonymous",
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
 * Throws when the session can't be read or deleted: Better Auth's sign-out swallows persistence
 * failures, and native clients clear the Keychain only after this succeeds.
 */
export async function deleteCurrentSession({
  headers,
  requestURL,
}: {
  headers: Headers;
  requestURL: string;
}) {
  const current = await sendNativeAuthRequest({
    handler: auth.handler,
    headers,
    path: "/get-session",
    query: { disableCookieCache: "true" },
    requestURL,
  });

  const token = getString(isJsonObject(current.body) ? current.body.session : null, "token");

  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }

  const signOut = await sendNativeAuthRequest({
    body: {},
    handler: auth.handler,
    headers,
    path: "/sign-out",
    requestURL,
  });

  return { headers: signOut.headers };
}
