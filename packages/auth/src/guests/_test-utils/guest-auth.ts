import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { betterAuth } from "better-auth/minimal";
import { oneTimeToken } from "better-auth/plugins";
import { accessGuardsPlugin } from "../../plugins/access-guards";
import { guestPlugin } from "../../plugins/guest";
import { baseAuthConfig } from "../../server";
import { stripePlugin } from "../../stripe/plugin";

const PASSWORD = "guest-test-password";

/** A real Better Auth instance with the production guest, guard and hook wiring. */
export const guestAuth = betterAuth({
  ...baseAuthConfig,
  baseURL: "http://localhost:3000",
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password) => password,
      verify: async ({ hash, password }) => hash === password,
    },
  },
  plugins: [
    oneTimeToken({ storeToken: "plain" }),
    stripePlugin(),
    guestPlugin(),
    accessGuardsPlugin(),
  ],
  rateLimit: { enabled: false },
  secret: "guest-link-test-secret-with-enough-entropy",
});

/** Turns a response's Set-Cookie headers into the Cookie header a browser would send next. */
function toCookieHeaders(responseHeaders: Headers) {
  const cookie = responseHeaders
    .getSetCookie()
    .map((setCookie) => setCookie.split(";")[0])
    .join("; ");

  return new Headers({ cookie });
}

/** Signs in as a new guest and returns the guest and the browser headers that carry its session. */
export async function signInAsGuest() {
  const { headers, response } = await guestAuth.api.signInAnonymous({ returnHeaders: true });

  return { guestId: response.user.id, headers: toCookieHeaders(headers) };
}

export function createTestEmail() {
  return `guest-link-${randomUUID()}@example.test`;
}

/** Signs up through Better Auth, optionally from a browser that still holds a guest session. */
export async function signUp({ email, headers }: { email: string; headers?: Headers }) {
  const result = await guestAuth.api.signUpEmail({
    body: { email, name: "Guest link learner", password: PASSWORD },
    headers,
    returnHeaders: true,
  });

  return { headers: toCookieHeaders(result.headers), userId: result.response.user.id };
}

/** Creates an existing account with a password, as if it signed up long ago. */
export async function createExistingAccount({ createdAt }: { createdAt: Date }) {
  const email = createTestEmail();
  const { userId } = await signUp({ email });

  await prisma.user.update({ data: { createdAt }, where: { id: userId } });

  return { email, userId };
}

/** Signs in from a browser that holds a guest session, the way the one-time token callback does. */
export async function signInWithOneTimeToken({
  email,
  guestHeaders,
}: {
  email: string;
  guestHeaders: Headers;
}) {
  const signIn = await guestAuth.api.signInEmail({
    body: { email, password: PASSWORD },
    returnHeaders: true,
  });

  const { token } = await guestAuth.api.generateOneTimeToken({
    headers: toCookieHeaders(signIn.headers),
  });

  return guestAuth.api.verifyOneTimeToken({ body: { token }, headers: guestHeaders });
}

export async function signInWithPassword({ email, headers }: { email: string; headers: Headers }) {
  return guestAuth.api.signInEmail({ body: { email, password: PASSWORD }, headers });
}
