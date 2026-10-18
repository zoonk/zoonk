import { type APIResponse, type BrowserContext } from "@playwright/test";
import { ONE_TIME_TOKEN_LOGIN_STATE_COOKIE } from "@zoonk/core/auth/ott/state";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser, generateOneTimeToken } from "@zoonk/e2e/fixtures/users";
import { mockCentralAuthTransport } from "./auth-transport";
import { expect, test } from "./fixtures";
import { openAsGuest } from "./guest-session";

/**
 * Reads the redirect target from a response that intentionally does not follow
 * redirects, so tests can inspect callback failures at the route boundary.
 */
function getRedirectLocation(response: APIResponse): string {
  const location = response.headers().location;

  if (!location) {
    throw new Error("Expected response to include a Location header");
  }

  return location;
}

/**
 * Reads required URL parameters from auth redirect URLs so a missing callback
 * state fails the test before the browser starts the callback request.
 */
function getRequiredSearchParam({ name, url }: { name: string; url: string }): string {
  const value = new URL(url).searchParams.get(name);

  if (!value) {
    throw new Error(`Expected ${url} to include ${name}`);
  }

  return value;
}

/**
 * Opens a login route without following it to central auth, reads where it sends the browser, and
 * checks the login state in its callback is the one `/login` bound to this browser's cookie.
 */
async function startLogin({ context, path }: { context: BrowserContext; path: string }) {
  const response = await context.request.get(path, { maxRedirects: 0 });

  expect(response.status()).toBe(307);

  const authUrl = getRedirectLocation(response);
  const callbackUrl = getRequiredSearchParam({ name: "redirectTo", url: authUrl });
  const state = getRequiredSearchParam({ name: "state", url: callbackUrl });
  const cookies = await context.cookies(getBaseURL());
  const stateCookie = cookies.find((cookie) => cookie.name === ONE_TIME_TOKEN_LOGIN_STATE_COOKIE);

  expect(stateCookie?.value).toBe(state);

  return { authUrl: new URL(authUrl), callbackUrl: new URL(callbackUrl) };
}

/**
 * Creates the local login state directly because these tests target the
 * callback contract: the callback may redeem a token only when the same browser
 * already has the state cookie that `/login` writes.
 */
async function createLoginState({
  baseURL,
  context,
}: {
  baseURL: string;
  context: BrowserContext;
}): Promise<string> {
  const state = crypto.randomUUID();

  await context.addCookies([
    { name: ONE_TIME_TOKEN_LOGIN_STATE_COOKIE, sameSite: "Lax", url: baseURL, value: state },
  ]);

  return state;
}

/**
 * Verifies callback failures at the route-response boundary so the browser
 * does not follow `/login` onward to the central auth host during this focused
 * main-app test.
 */
function expectAuthErrorRedirect(response: APIResponse): void {
  expect(response.status()).toBe(302);
  expect(getRedirectLocation(response)).toBe("/login?error=auth");
}

test.describe("Auth Callback", () => {
  test("starts login in the page's language with a state-bound return path, never an unsafe one", async ({
    context,
  }) => {
    const nextPath = "/b/ai/c/course/ch/chapter/l/lesson";
    const unsafeNextPath = String.raw`/\\evil.example/path`;

    // Without a page to go back to, sign-in opens Today, in the page's language.
    const localized = await startLogin({ context, path: "/pt/login" });
    expect(localized.authUrl.searchParams.get("locale")).toBe("pt");
    expect(localized.authUrl.searchParams.get("error")).toBeNull();
    expect(localized.callbackUrl.searchParams.get("next")).toBe("/pt/today");

    const returning = await startLogin({
      context,
      path: `/pt/login?next=${encodeURIComponent(nextPath)}`,
    });

    expect(returning.callbackUrl.searchParams.get("next")).toBe(nextPath);

    // A backslash-based network-path return target is dropped.
    const unsafe = await startLogin({
      context,
      path: `/pt/login?next=${encodeURIComponent(unsafeNextPath)}`,
    });

    expect(unsafe.callbackUrl.searchParams.get("next")).toBe("/pt/today");
  });

  test("a sign-in the callback couldn't finish starts again for the same page, saying so", async ({
    browser,
  }) => {
    const baseURL = getBaseURL();
    const ctx = await browser.newContext({ baseURL });
    const state = await createLoginState({ baseURL, context: ctx });

    const failed = await ctx.request.get(
      `/auth/callback?state=${encodeURIComponent(state)}&token=invalid-token-abc&next=${encodeURIComponent("/level")}`,
      { maxRedirects: 0 },
    );

    expect(getRedirectLocation(failed)).toBe("/login?error=auth&next=%2Flevel");

    const again = await startLogin({ context: ctx, path: getRedirectLocation(failed) });
    expect(again.authUrl.searchParams.get("error")).toBe("expired");
    expect(again.callbackUrl.searchParams.get("next")).toBe("/level");

    await ctx.close();
  });

  test("a real login link opens the auth form with one document request", async ({
    context,
    page,
  }) => {
    const loginRequests: string[] = [];
    await mockCentralAuthTransport(page);
    await page.goto("/plan");

    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/login") {
        loginRequests.push(request.resourceType());
      }
    });

    await page.getByRole("main").getByRole("link", { exact: true, name: "Log in" }).click();
    await expect(page.getByLabel("Email")).toBeVisible();
    expect(loginRequests).toEqual(["document"]);
    const cookies = await context.cookies(getBaseURL());
    expect(cookies.some((cookie) => cookie.name === ONE_TIME_TOKEN_LOGIN_STATE_COOKIE)).toBe(true);
  });

  test("signs in on a valid token and opens the learner's home", async ({ browser }) => {
    const baseURL = getBaseURL();
    const user = await createE2EUser(baseURL);
    const token = await generateOneTimeToken(baseURL, user);

    const ctx = await browser.newContext({ baseURL });
    const state = await createLoginState({ baseURL, context: ctx });
    const page = await ctx.newPage();

    await page.goto(
      `/auth/callback?state=${encodeURIComponent(state)}&token=${encodeURIComponent(token)}`,
    );

    // Home sends a learner without a goal to Today, which asks them to start one right there.
    await page.waitForURL(/\/today$/u);
    await expect(page.getByRole("textbox", { name: "I want to" })).toBeVisible();

    const session = await page.request.get("/api/auth/get-session");
    expect(await session.json()).toMatchObject({ user: { email: user.email } });

    await ctx.close();
  });

  test("leaves the session hint beside the session it signs in, and tells the page it lands on", async ({
    browser,
  }) => {
    const baseURL = getBaseURL();
    const [user, guest] = await Promise.all([createE2EUser(baseURL), openAsGuest(browser)]);
    const token = await generateOneTimeToken(baseURL, user);

    const ctx = guest.context;
    const state = await createLoginState({ baseURL, context: ctx });

    // The browser still holds the guest's session when the token signs the learner in.
    const response = await ctx.request.get(
      `/auth/callback?state=${encodeURIComponent(state)}&token=${encodeURIComponent(token)}`,
      { maxRedirects: 0 },
    );

    expect(response.status()).toBe(302);

    const cookies = await ctx.cookies(baseURL);
    const hint = cookies.find((cookie) => cookie.name === "zoonk-signed-in");
    const session = cookies.find((cookie) => cookie.name.endsWith("session_token"));

    expect(hint).toMatchObject({ httpOnly: false, sameSite: "Lax", value: "1" });
    expect(Math.abs((hint?.expires ?? 0) - (session?.expires ?? 0))).toBeLessThan(60);

    // The page the sign-in lands on tells the browser's other tabs to reload.
    expect(cookies.find((cookie) => cookie.name === "zoonk-signed-in-now")?.value).toBe("1");

    await ctx.close();
  });

  test("redirects to the requested app path on valid token", async ({ browser }) => {
    const baseURL = getBaseURL();
    const user = await createE2EUser(baseURL);
    const token = await generateOneTimeToken(baseURL, user);
    const nextPath = "/level";

    const ctx = await browser.newContext({ baseURL });
    const state = await createLoginState({ baseURL, context: ctx });
    const page = await ctx.newPage();

    await page.goto(
      `/auth/callback?state=${encodeURIComponent(state)}&token=${encodeURIComponent(token)}&next=${encodeURIComponent(nextPath)}`,
    );

    await page.waitForURL(/\/level$/u);

    await ctx.close();
  });

  test("redirects to home for backslash-based network-path return targets", async ({ browser }) => {
    const baseURL = getBaseURL();
    const user = await createE2EUser(baseURL);
    const token = await generateOneTimeToken(baseURL, user);
    const unsafeNextPath = String.raw`/\\evil.example/path`;

    const ctx = await browser.newContext({ baseURL });
    const state = await createLoginState({ baseURL, context: ctx });

    const response = await ctx.request.get(
      `/auth/callback?state=${encodeURIComponent(state)}&token=${encodeURIComponent(token)}&next=${encodeURIComponent(unsafeNextPath)}`,
      { maxRedirects: 0 },
    );

    expect(response.status()).toBe(302);
    expect(getRedirectLocation(response)).toBe("/");

    await ctx.close();
  });

  test("redirects to login when a valid token is not bound to local login state", async ({
    browser,
  }) => {
    const baseURL = getBaseURL();
    const user = await createE2EUser(baseURL);
    const token = await generateOneTimeToken(baseURL, user);
    const ctx = await browser.newContext({ baseURL });

    const response = await ctx.request.get(
      `/auth/callback?state=attacker-state&token=${encodeURIComponent(token)}`,
      { maxRedirects: 0 },
    );

    expectAuthErrorRedirect(response);

    await ctx.close();
  });

  test("redirects to login on invalid token", async ({ browser }) => {
    const baseURL = getBaseURL();
    const ctx = await browser.newContext({ baseURL });
    const state = await createLoginState({ baseURL, context: ctx });

    const response = await ctx.request.get(
      `/auth/callback?state=${encodeURIComponent(state)}&token=invalid-token-abc`,
      { maxRedirects: 0 },
    );

    expectAuthErrorRedirect(response);

    await ctx.close();
  });
});
