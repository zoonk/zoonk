import { prisma } from "@zoonk/db";
import { afterEach, describe, expect, it, vi } from "vitest";
import { auth as productionAuth } from "./auth";
import { BETTER_AUTH_BASE_PATH, SESSION_EXPIRES_IN_DAYS } from "./config";
import { deleteCurrentSession } from "./native-sessions";
import { SESSION_HINT_COOKIE } from "./session-hint";
import { SESSION_REFRESH_PATH, getSessionReadQuery } from "./session-refresh";

const ORIGIN = "http://localhost:3000";
const SESSION_COOKIE = "better-auth.session_token";
const SESSION_CACHE_COOKIE = "better-auth.session_data";
const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_URL = `${ORIGIN}/v1/sessions/current`;

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

function findSession(userId: string) {
  return prisma.session.findFirstOrThrow({
    select: { expiresAt: true, updatedAt: true },
    where: { userId },
  });
}

/** The browser's refresh of its copy of the session, as a page in use sends it. */
function refreshSessionCopy(cookies: Headers) {
  return productionAuth.handler(
    new Request(`${ORIGIN}${SESSION_REFRESH_PATH}`, { headers: cookies }),
  );
}

/** A browser's cookies over days: each one until its Max-Age runs out. */
function createCookieJar() {
  const cookies = new Map<string, { expiresAt: number; value: string }>();

  return {
    apply(headers: Headers) {
      for (const header of headers.getSetCookie()) {
        const [pair = "", ...attributes] = header.split(";");
        const [name = "", ...value] = pair.split("=");

        const maxAge = attributes
          .map((part) => /^\s*max-age=(?<seconds>-?\d+)/iu.exec(part)?.groups?.seconds)
          .find(Boolean);

        const seconds = maxAge === undefined ? Infinity : Number(maxAge);

        if (seconds <= 0) {
          cookies.delete(name);
        } else {
          cookies.set(name, { expiresAt: Date.now() + seconds * 1000, value: value.join("=") });
        }
      }
    },
    headers() {
      const cookie = [...cookies]
        .filter(([, { expiresAt }]) => expiresAt > Date.now())
        .map(([name, { value }]) => `${name}=${value}`)
        .join("; ");

      return new Headers({ cookie });
    },
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

describe("session copy refresh", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("gives a session renewed within the day only a new copy, which reads then use", async () => {
    const { cookies, userId } = await signInGuestWithSessionUsed({ days: 0.5 });
    const before = await findSession(userId);

    const response = await refreshSessionCopy(cookies);
    const refreshed = readSetCookies(response);
    const copy = refreshed.get(SESSION_CACHE_COOKIE)?.value;

    expect(response.status).toBe(200);
    expect(copy).toBeTruthy();
    expect(refreshed.has(SESSION_COOKIE)).toBe(false);
    await expect(findSession(userId)).resolves.toStrictEqual(before);

    const { internalAdapter } = await productionAuth.$context;
    const lookups = vi.spyOn(internalAdapter, "findSession");
    const session = cookies.get("cookie")?.split("; ")[0];

    const read = await productionAuth.api.getSession({
      headers: new Headers({ cookie: `${session}; ${SESSION_CACHE_COOKIE}=${copy}` }),
    });

    expect(read?.user.id).toBe(userId);
    expect(lookups).not.toHaveBeenCalled();

    await prisma.user.delete({ where: { id: userId } });
  });

  it("renews a due session past the browser's copy, with its cookie and the session hint beside it", async () => {
    const { cookies, userId } = await signInGuestWithSessionUsed({ days: 3 });
    const before = await findSession(userId);

    // A page's read answers from the copy and renews nothing.
    await productionAuth.api.getSession({ headers: cookies });
    await expect(findSession(userId)).resolves.toStrictEqual(before);

    const response = await refreshSessionCopy(cookies);
    const refreshed = readSetCookies(response);
    const renewed = await findSession(userId);

    expect(response.status).toBe(200);
    expect(refreshed.get(SESSION_COOKIE)?.value).toBeTruthy();
    expect(refreshed.get(SESSION_CACHE_COOKIE)?.value).toBeTruthy();
    expect(refreshed.get(SESSION_HINT_COOKIE)?.value).toMatch(/^(?!0$)./u);
    expect(renewed.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());

    await prisma.user.delete({ where: { id: userId } });
  });
});

describe("app session reads", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps a daily learner signed in past day 35", async () => {
    // Run in the past so rate-limit cleanup cannot delete other tests' current rows.
    const start = Date.now() - 36 * DAY_MS;
    vi.useFakeTimers({ now: start, toFake: ["Date"] });
    const jar = createCookieJar();
    const { headers, response } = await productionAuth.api.signInAnonymous({ returnHeaders: true });
    jar.apply(headers);

    try {
      for (let day = 1; day <= 35; day += 1) {
        vi.setSystemTime(start + day * DAY_MS);
        const page = jar.headers();

        // oxlint-disable-next-line no-await-in-loop -- Each day follows the previous response.
        const session = await productionAuth.api.getSession({
          headers: page,
          query: getSessionReadQuery(page),
        });

        expect(session?.user.id, `signed in on day ${day}`).toBe(response.user.id);

        // oxlint-disable-next-line no-await-in-loop -- The visible page refreshes after its read.
        const refreshed = await refreshSessionCopy(page);
        expect(refreshed.status).toBe(200);
        jar.apply(refreshed.headers);
      }

      const read = await productionAuth.api.getSession({ headers: jar.headers() });
      expect(read?.user.id).toBe(response.user.id);
    } finally {
      vi.useRealTimers();
      await prisma.user.delete({ where: { id: response.user.id } });
    }
  });

  it("renews a due bearer session on the app's own read", async () => {
    const { bearer, userId } = await signInGuestWithSessionUsed({ days: 3 });

    try {
      const before = await findSession(userId);

      const session = await productionAuth.api.getSession({
        headers: bearer,
        query: getSessionReadQuery(bearer),
      });

      expect(session?.user.id).toBe(userId);
      const renewed = await findSession(userId);
      expect(renewed.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
    } finally {
      await prisma.user.delete({ where: { id: userId } });
    }
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
