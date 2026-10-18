import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { betterAuth } from "better-auth/minimal";
import { describe, expect, it } from "vitest";
import { BETTER_AUTH_BASE_PATH, SESSION_EXPIRES_IN_DAYS } from "../config";
import { baseAuthConfig, baseAuthPlugins, fullPlugins } from "../server";
import { SESSION_HINT_COOKIE } from "../session-hint";

const ORIGIN = "http://localhost:3000";
const SECRET = "session-hint-plugin-test-secret-with-enough-entropy";
const SESSION_COOKIE = "better-auth.session_token";
const SESSION_MAX_AGE = String(60 * 60 * 24 * SESSION_EXPIRES_IN_DAYS);
const PASSWORD = "session-hint-password";

/** Production's plugins in production's order, with email and password to sign learners in. */
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

type SetCookie = { attributes: Map<string, string>; value: string };

/** A response's cookies as the browser applies them: the last `Set-Cookie` for a name wins. */
function readSetCookies(response: Response): Map<string, SetCookie> {
  return new Map(
    response.headers.getSetCookie().map((header) => {
      const [pair = "", ...attributes] = header.split(";").map((part) => part.trim());
      const [name = "", ...value] = pair.split("=");

      const parsed = attributes.map((attribute) => {
        const [key = "", ...rest] = attribute.split("=");
        return [key.toLowerCase(), rest.join("=")] as const;
      });

      return [name, { attributes: new Map(parsed), value: value.join("=") }];
    }),
  );
}

/** The `Cookie` header a browser sends after a response, from the cookies it kept. */
function toCookieHeader(response: Response): string {
  return [...readSetCookies(response)]
    .filter(([, cookie]) => cookie.attributes.get("max-age") !== "0")
    .map(([name, cookie]) => `${name}=${cookie.value}`)
    .join("; ");
}

function request({
  body,
  cookie,
  method = "POST",
  path,
}: {
  body?: unknown;
  cookie?: string;
  method?: "GET" | "POST";
  path: string;
}): Promise<Response> {
  const headers = new Headers({ "content-type": "application/json", origin: ORIGIN });

  if (cookie) {
    headers.set("cookie", cookie);
  }

  return auth.handler(
    new Request(`${ORIGIN}${BETTER_AUTH_BASE_PATH}${path}`, {
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
      headers,
      method,
    }),
  );
}

async function signUp() {
  const email = `session-hint-${randomUUID()}@example.test`;

  const response = await request({
    body: { email, name: "Learner", password: PASSWORD },
    path: "/sign-up/email",
  });

  const { user } = await response.json();

  return { cookie: toCookieHeader(response), email, response, userId: String(user.id) };
}

function getHint(response: Response): SetCookie | undefined {
  return readSetCookies(response).get(SESSION_HINT_COOKIE);
}

/** The hint says `1` beside a session cookie it shares its lifetime and scope with. */
function expectHintBesideSession(response: Response) {
  const cookies = readSetCookies(response);
  const session = cookies.get(SESSION_COOKIE);
  const hint = cookies.get(SESSION_HINT_COOKIE);

  expect(session?.value).toBeTruthy();
  expect(hint?.value).toBe("1");
  expect(hint?.attributes.get("max-age")).toBe(session?.attributes.get("max-age"));
  expect(hint?.attributes.get("path")).toBe("/");
  expect(hint?.attributes.get("samesite")?.toLowerCase()).toBe("lax");
  expect(hint?.attributes.has("httponly")).toBe(false);
}

describe("session hint", () => {
  it("says 1 for a learner who signs in, for as long as their session, on every sign-in", async () => {
    const { email, response } = await signUp();

    expectHintBesideSession(response);

    expect(readSetCookies(response).get(SESSION_COOKIE)?.attributes.get("max-age")).toBe(
      SESSION_MAX_AGE,
    );

    const again = await request({ body: { email, password: PASSWORD }, path: "/sign-in/email" });
    expectHintBesideSession(again);

    // A session that ends with the browser leaves a hint that ends with it.
    const brief = await request({
      body: { email, password: PASSWORD, rememberMe: false },
      path: "/sign-in/email",
    });

    expectHintBesideSession(brief);
    expect(getHint(brief)?.attributes.has("max-age")).toBe(false);
  });

  it("says nobody when signing out deletes the session cookie", async () => {
    const { cookie } = await signUp();

    const response = await request({ cookie, path: "/sign-out" });
    const cookies = readSetCookies(response);

    expect(cookies.get(SESSION_COOKIE)?.attributes.get("max-age")).toBe("0");
    expect(cookies.get(SESSION_HINT_COOKIE)?.value).toBe("0");
    expect(cookies.get(SESSION_HINT_COOKIE)?.attributes.has("max-age")).toBe(false);
  });

  it("says 1 in the response that makes a guest", async () => {
    const response = await request({ path: "/sign-in/anonymous" });
    const { user } = await response.clone().json();

    expect(user.isAnonymous).toBe(true);
    expectHintBesideSession(response);
  });

  it("says 1 when a sign-in token signs a learner in", async () => {
    const learner = await signUp();

    const generated = await request({
      cookie: learner.cookie,
      method: "GET",
      path: "/one-time-token/generate",
    });

    const { token } = await generated.json();
    const response = await request({ body: { token }, path: "/one-time-token/verify" });

    expect(response.status).toBe(200);
    expectHintBesideSession(response);
  });

  it("says 1 again when a session read renews the session cookie", async () => {
    const { response: signedUp, userId } = await signUp();
    const session = readSetCookies(signedUp).get(SESSION_COOKIE);

    // Old enough to renew; the request carries only the session cookie, so no cached copy answers.
    await prisma.session.updateMany({
      data: { expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 20) },
      where: { userId },
    });

    const response = await request({
      cookie: `${SESSION_COOKIE}=${session?.value}`,
      method: "GET",
      path: "/get-session",
    });

    await expect(response.clone().json()).resolves.toMatchObject({ user: { id: userId } });
    expectHintBesideSession(response);
  });

  it("writes nothing on a session read that keeps the session, or finds none without a hint", async () => {
    const { cookie } = await signUp();

    const responses = await Promise.all([
      request({
        cookie,
        method: "GET",
        path: "/get-session?disableCookieCache=true&disableRefresh=true",
      }),
      request({ method: "GET", path: "/get-session" }),
      request({ cookie: `${SESSION_HINT_COOKIE}=0`, method: "GET", path: "/get-session" }),
    ]);

    for (const response of responses) {
      expect(response.headers.getSetCookie()).toStrictEqual([]);
    }
  });

  it("says nobody when a session read finds the session gone and deletes its cookie", async () => {
    const { cookie, userId } = await signUp();
    await prisma.session.deleteMany({ where: { userId } });

    const response = await request({
      cookie,
      method: "GET",
      path: "/get-session?disableCookieCache=true&disableRefresh=true",
    });

    const cookies = readSetCookies(response);

    expect(cookies.get(SESSION_COOKIE)?.attributes.get("max-age")).toBe("0");
    expect(cookies.get(SESSION_HINT_COOKIE)?.value).toBe("0");
  });

  it.each([
    ["a hint saying a session", "1"],
    ["an unreadable hint", "junk"],
  ])(
    "drops %s kept without a session when a session read finds none, never saying nobody",
    async (_, hint) => {
      const response = await request({
        cookie: `${SESSION_HINT_COOKIE}=${hint}`,
        method: "GET",
        path: "/get-session?disableCookieCache=true&disableRefresh=true",
      });

      expect(readSetCookies(response).has(SESSION_COOKIE)).toBe(false);
      expect(getHint(response)).toMatchObject({ value: "" });
      expect(getHint(response)?.attributes.get("max-age")).toBe("0");
    },
  );

  it("leaves the hint alone when a response doesn't touch the session cookie", async () => {
    const { cookie, email } = await signUp();

    const [failed, unrelated] = await Promise.all([
      request({ body: { email, password: "wrong-password" }, path: "/sign-in/email" }),
      request({ cookie, method: "GET", path: "/ok" }),
    ]);

    expect(failed.status).toBe(401);

    for (const response of [failed, unrelated]) {
      expect(getHint(response)).toBeUndefined();
    }
  });
});
