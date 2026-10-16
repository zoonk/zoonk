import { prisma } from "@zoonk/db";
import { afterEach, describe, expect, it, vi } from "vitest";
import { auth as productionAuth } from "./auth";
import { BETTER_AUTH_BASE_PATH, SESSION_EXPIRES_IN_DAYS } from "./config";
import { deleteCurrentSession } from "./native-sessions";
import { SESSION_HINT_COOKIE } from "./session-hint";

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
 * browser sends it: its cookie, with the cached copy of the session from sign-in beside it.
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

  return { cookies: new Headers({ cookie, origin: ORIGIN }), userId };
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
