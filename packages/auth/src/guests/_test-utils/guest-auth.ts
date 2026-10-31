import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { betterAuth } from "better-auth/minimal";
import { oneTimeToken } from "better-auth/plugins";
import { accessGuardsPlugin } from "../../plugins/access-guards";
import { guestPlugin } from "../../plugins/guest";
import { baseAuthConfig } from "../../server";
import { stripePlugin } from "../../stripe/plugin";

const PASSWORD = "guest-test-password";

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

function toCookieHeaders(responseHeaders: Headers) {
  const cookie = responseHeaders
    .getSetCookie()
    .map((setCookie) => setCookie.split(";")[0])
    .join("; ");

  return new Headers({ cookie });
}

export async function signInAsGuest() {
  const { headers, response } = await guestAuth.api.signInAnonymous({ returnHeaders: true });

  return { guestId: response.user.id, headers: toCookieHeaders(headers) };
}

export function createTestEmail() {
  return `guest-link-${randomUUID()}@example.test`;
}

export async function signUp({ email, headers }: { email: string; headers?: Headers }) {
  const result = await guestAuth.api.signUpEmail({
    body: { email, name: "Guest link learner", password: PASSWORD },
    headers,
    returnHeaders: true,
  });

  return { headers: toCookieHeaders(result.headers), userId: result.response.user.id };
}

export async function createExistingAccount({ createdAt }: { createdAt: Date }) {
  const email = createTestEmail();
  const { userId } = await signUp({ email });

  await prisma.user.update({ data: { createdAt }, where: { id: userId } });

  return { email, userId };
}

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
