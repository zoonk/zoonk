import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { betterAuth } from "better-auth/minimal";
import { afterEach, describe, expect, it, vi } from "vitest";
import { auth as productionAuth } from "./auth";
import { BETTER_AUTH_BASE_PATH, SESSION_EXPIRES_IN_DAYS } from "./config";
import { deleteCurrentSession, renewCurrentSession } from "./native-sessions";
import { baseAuthConfig, baseAuthPlugins, fullPlugins } from "./server";
import { SESSION_HINT_COOKIE } from "./session-hint";
import { encodeSessionHintTag } from "./session-hint-tag";
import { SESSION_RENEWAL_PATH, SESSION_RENEWAL_REQUEST } from "./session-renewal";

const ORIGIN = "http://localhost:3000";
const SECRET = "session-refresh-test-secret-with-enough-entropy";
const SESSION_COOKIE = "better-auth.session_token";
const SESSION_CACHE_COOKIE = "better-auth.session_data";
const DAY_MS = 24 * 60 * 60 * 1000;
const PASSWORD = "session-refresh-password";
const SESSION_URL = `${ORIGIN}/v1/sessions/current`;

/** Production's session rules and plugins, with email and password to sign learners in. */
const auth = betterAuth({
  ...baseAuthConfig,
  baseURL: ORIGIN,
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password) => password,
      verify: async ({ hash, password }) => hash === password,
    },
  },
  plugins: [...baseAuthPlugins, ...fullPlugins],
  rateLimit: { enabled: false },
  secret: SECRET,
});

/** A response's cookies as the browser applies them: name → value and whether it's deleted. */
function readSetCookies(response: { headers: Headers }) {
  return new Map(
    response.headers.getSetCookie().map((header) => {
      const [pair = ""] = header.split(";");
      const [name = "", ...value] = pair.split("=");
      return [name, { deleted: /max-age=0/iu.test(header), value: value.join("=") }];
    }),
  );
}

function request({
  cookie,
  method,
  path = `${BETTER_AUTH_BASE_PATH}/get-session`,
}: {
  cookie: string;
  method: "GET" | "POST";
  path?: string;
}) {
  return auth.handler(
    new Request(`${ORIGIN}${path}`, { headers: { cookie, origin: ORIGIN }, method }),
  );
}

/** A learner whose session was last renewed `days` ago, with only its session cookie to send. */
async function signUpWithSessionUsed({ days }: { days: number }) {
  const response = await auth.handler(
    new Request(`${ORIGIN}${BETTER_AUTH_BASE_PATH}/sign-up/email`, {
      body: JSON.stringify({
        email: `session-refresh-${randomUUID()}@example.test`,
        name: "Learner",
        password: PASSWORD,
      }),
      headers: { "content-type": "application/json", origin: ORIGIN },
      method: "POST",
    }),
  );

  const { user } = await response.json();
  const usedAt = new Date(Date.now() - days * DAY_MS);

  await prisma.session.updateMany({
    data: {
      expiresAt: new Date(usedAt.getTime() + SESSION_EXPIRES_IN_DAYS * DAY_MS),
      updatedAt: usedAt,
    },
    where: { userId: user.id },
  });

  const session = readSetCookies(response).get(SESSION_COOKIE);

  return { cookie: `${SESSION_COOKIE}=${session?.value}`, userId: String(user.id) };
}

function findSession(userId: string) {
  return prisma.session.findFirstOrThrow({
    select: { expiresAt: true, updatedAt: true },
    where: { userId },
  });
}

/**
 * A guest signed in through production auth whose session was last renewed `days` ago, as a
 * native app sends it (its bearer token) and as a browser does (its cookie, with the cached copy
 * of the session from sign-in beside it).
 */
async function signInGuestWithSessionUsed({ days }: { days: number }) {
  const { headers, response } = await productionAuth.api.signInAnonymous({ returnHeaders: true });
  const userId = response.user.id;
  const usedAt = new Date(Date.now() - days * DAY_MS);

  await prisma.session.updateMany({
    data: {
      expiresAt: new Date(usedAt.getTime() + SESSION_EXPIRES_IN_DAYS * DAY_MS),
      updatedAt: usedAt,
    },
    where: { userId },
  });

  const signedIn = readSetCookies({ headers });
  expect(signedIn.get(SESSION_CACHE_COOKIE)?.value).toBeTruthy();

  const cookie = [SESSION_COOKIE, SESSION_CACHE_COOKIE]
    .map((name) => `${name}=${signedIn.get(name)?.value}`)
    .join("; ");

  return {
    bearer: new Headers({ authorization: `Bearer ${headers.get("set-auth-token")}` }),
    cookies: new Headers({ cookie, origin: ORIGIN }),
    userId,
  };
}

/**
 * Makes production auth answer `path` with a failure. A failed session read or a refused sign-out
 * can't be produced safely on the shared test database, so this stands in for that outage.
 */
function failAuthRoute({ path, status }: { path: string; status: number }) {
  const handler = productionAuth.handler;

  return vi
    .spyOn(productionAuth, "handler")
    .mockImplementation((authRequest) =>
      new URL(authRequest.url).pathname === `${BETTER_AUTH_BASE_PATH}${path}`
        ? Promise.resolve(Response.json({ message: "Unavailable" }, { status }))
        : handler(authRequest),
    );
}

describe("session renewal", () => {
  it("never renews a session on a GET, even one due, and says it's due", async () => {
    const { cookie, userId } = await signUpWithSessionUsed({ days: 3 });
    const before = await findSession(userId);

    const response = await request({ cookie, method: "GET" });

    await expect(response.json()).resolves.toMatchObject({ needsRefresh: true });
    expect(readSetCookies(response).has(SESSION_COOKIE)).toBe(false);
    expect(readSetCookies(response).has(SESSION_HINT_COOKIE)).toBe(false);
    await expect(findSession(userId)).resolves.toStrictEqual(before);
  });

  it("never deletes an expired session's row on a GET, only the browser's cookies", async () => {
    const { cookie, userId } = await signUpWithSessionUsed({ days: SESSION_EXPIRES_IN_DAYS + 1 });

    const response = await request({ cookie, method: "GET" });
    const cookies = readSetCookies(response);

    expect(cookies.get(SESSION_COOKIE)?.deleted).toBe(true);
    expect(cookies.get(SESSION_HINT_COOKIE)?.value).toBe("0");
    await expect(prisma.session.count({ where: { userId } })).resolves.toBe(1);
  });

  it("renews a due session on a POST, with its cookie and the learner's hint beside it", async () => {
    const { cookie, userId } = await signUpWithSessionUsed({ days: 3 });

    const response = await request({ cookie, method: "POST" });
    const cookies = readSetCookies(response);
    const renewed = await findSession(userId);

    expect(response.status).toBe(200);
    expect(cookies.get(SESSION_COOKIE)?.value).toBeTruthy();

    expect(cookies.get(SESSION_HINT_COOKIE)?.value).toBe(
      encodeSessionHintTag({ secret: SECRET, userId }),
    );

    expect(renewed.updatedAt.getTime()).toBeGreaterThan(Date.now() - 60_000);

    expect(renewed.expiresAt.getTime()).toBeGreaterThan(
      Date.now() + (SESSION_EXPIRES_IN_DAYS - 1) * DAY_MS,
    );
  });

  it("renews from the browser's renewal path even with a cached copy of the session beside it", async () => {
    const { cookie, userId } = await signUpWithSessionUsed({ days: 3 });

    // A page's read leaves a cached copy of the session beside its cookie.
    const read = await request({ cookie, method: "GET" });
    const cache = readSetCookies(read).get(SESSION_CACHE_COOKIE);
    const cached = `${cookie}; ${SESSION_CACHE_COOKIE}=${cache?.value}`;
    expect(cache?.value).toBeTruthy();

    // A plain POST answers from that copy and renews nothing.
    const before = await findSession(userId);
    await request({ cookie: cached, method: "POST" });
    await expect(findSession(userId)).resolves.toStrictEqual(before);

    // The renewal exactly as the browser sends it.
    const response = await auth.handler(
      new Request(`${ORIGIN}${SESSION_RENEWAL_PATH}`, {
        ...SESSION_RENEWAL_REQUEST,
        headers: { ...SESSION_RENEWAL_REQUEST.headers, cookie: cached, origin: ORIGIN },
      }),
    );

    const cookies = readSetCookies(response);
    const renewed = await findSession(userId);

    expect(response.status).toBe(200);
    expect(cookies.get(SESSION_COOKIE)?.value).toBeTruthy();

    expect(cookies.get(SESSION_HINT_COOKIE)?.value).toBe(
      encodeSessionHintTag({ secret: SECRET, userId }),
    );

    expect(renewed.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });

  it("writes nothing on a POST for a session renewed within the day", async () => {
    const { cookie, userId } = await signUpWithSessionUsed({ days: 0.5 });
    const before = await findSession(userId);

    const response = await request({ cookie, method: "POST" });

    expect(response.status).toBe(200);
    expect(readSetCookies(response).has(SESSION_COOKIE)).toBe(false);
    await expect(findSession(userId)).resolves.toStrictEqual(before);
  });

  it("renews a native app's due bearer session, and tells it when the session is gone", async () => {
    const { bearer, userId } = await signInGuestWithSessionUsed({ days: 3 });

    await expect(
      renewCurrentSession({ headers: bearer, requestURL: SESSION_URL }),
    ).resolves.toStrictEqual({ headers: expect.any(Headers) });

    const renewed = await findSession(userId);
    expect(renewed.updatedAt.getTime()).toBeGreaterThan(Date.now() - 60_000);

    await prisma.session.deleteMany({ where: { userId } });

    await expect(
      renewCurrentSession({ headers: bearer, requestURL: SESSION_URL }),
    ).resolves.toBeNull();

    await prisma.user.delete({ where: { id: userId } });
  });

  it("renews a cookie client's due session past its cached copy, with the renewed cookies", async () => {
    const { cookies, userId } = await signInGuestWithSessionUsed({ days: 3 });
    const before = await findSession(userId);

    const renewal = await renewCurrentSession({ headers: cookies, requestURL: SESSION_URL });
    const renewed = await findSession(userId);
    const renewedCookies = readSetCookies({ headers: renewal?.headers ?? new Headers() });

    expect(renewed.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
    expect(renewedCookies.get(SESSION_COOKIE)?.value).toBeTruthy();
    expect(renewedCookies.get(SESSION_HINT_COOKIE)?.value).toMatch(/^(?!0$)./u);

    await prisma.user.delete({ where: { id: userId } });
  });

  it("tells a cookie client its session ended even while its cached copy still says signed in", async () => {
    const { cookies, userId } = await signInGuestWithSessionUsed({ days: 3 });

    await prisma.session.deleteMany({ where: { userId } });

    await expect(
      renewCurrentSession({ headers: cookies, requestURL: SESSION_URL }),
    ).resolves.toBeNull();

    await prisma.user.delete({ where: { id: userId } });
  });
});

describe("native sign-out", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws, keeping the session, when it can't read the session to delete", async () => {
    const { cookies, userId } = await signInGuestWithSessionUsed({ days: 0 });
    const handler = failAuthRoute({ path: "/get-session", status: 500 });

    await expect(
      deleteCurrentSession({ headers: cookies, requestURL: SESSION_URL }),
    ).rejects.toMatchObject({ statusCode: 500 });

    expect(
      handler.mock.calls.map(([authRequest]) => new URL(authRequest.url).pathname),
    ).not.toContain(`${BETTER_AUTH_BASE_PATH}/sign-out`);

    await expect(prisma.session.count({ where: { userId } })).resolves.toBe(1);
    await prisma.user.delete({ where: { id: userId } });
  });

  it("throws instead of answering signed out when the sign-out is refused", async () => {
    const { cookies, userId } = await signInGuestWithSessionUsed({ days: 0 });
    failAuthRoute({ path: "/sign-out", status: 429 });

    await expect(
      deleteCurrentSession({ headers: cookies, requestURL: SESSION_URL }),
    ).rejects.toMatchObject({ statusCode: 429 });

    await prisma.user.delete({ where: { id: userId } });
  });

  it("deletes the session and clears a cookie client's cookies", async () => {
    const { cookies, userId } = await signInGuestWithSessionUsed({ days: 0 });

    const signOut = await deleteCurrentSession({ headers: cookies, requestURL: SESSION_URL });
    const cleared = readSetCookies(signOut);

    expect(cleared.get(SESSION_COOKIE)?.deleted).toBe(true);
    expect(cleared.get(SESSION_HINT_COOKIE)?.value).toBe("0");
    await expect(prisma.session.count({ where: { userId } })).resolves.toBe(0);

    await prisma.user.delete({ where: { id: userId } });
  });
});
