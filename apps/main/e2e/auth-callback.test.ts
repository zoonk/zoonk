import { type APIResponse, type BrowserContext, type Page } from "@playwright/test";
import { ONE_TIME_TOKEN_LOGIN_STATE_COOKIE } from "@zoonk/core/auth/ott/state";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser, generateOneTimeToken } from "@zoonk/e2e/fixtures/users";
import { expect, test } from "./fixtures";

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
 * Opens a login page and reads the central-auth URL it went to, with central auth stood in for, and
 * checks the login state in its callback is the one `/login` bound to this browser's cookie.
 */
async function startLogin({
  authUrls,
  context,
  page,
  path,
}: {
  authUrls: string[];
  context: BrowserContext;
  page: Page;
  path: string;
}) {
  const before = authUrls.length;

  await page.goto(path);
  await expect.poll(() => authUrls.length).toBe(before + 1);

  const authUrl = authUrls.at(-1) ?? "";
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
    page,
  }) => {
    const authUrls: string[] = [];
    const nextPath = "/b/ai/c/course/ch/chapter/l/lesson";
    const unsafeNextPath = String.raw`/\\evil.example/path`;

    // The login state comes from `getRandomValues`, so it starts where `randomUUID` is missing.
    await page.addInitScript(() => {
      Object.defineProperty(globalThis.crypto, "randomUUID", { value: undefined });
    });

    await page.route("**/auth/login**", async (route) => {
      authUrls.push(route.request().url());
      await route.fulfill({ body: "Auth app", contentType: "text/html", status: 200 });
    });

    const localized = await startLogin({ authUrls, context, page, path: "/pt/login" });
    expect(localized.authUrl.searchParams.get("locale")).toBe("pt");

    const returning = await startLogin({
      authUrls,
      context,
      page,
      path: `/login?next=${encodeURIComponent(nextPath)}`,
    });

    expect(returning.callbackUrl.searchParams.get("next")).toBe(nextPath);

    // A backslash-based network-path return target is dropped.
    const unsafe = await startLogin({
      authUrls,
      context,
      page,
      path: `/login?next=${encodeURIComponent(unsafeNextPath)}`,
    });

    expect(unsafe.callbackUrl.searchParams.get("next")).toBeNull();
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

    // Home sends a learner without a goal to Today, which asks them to start one.
    await page.waitForURL(/\/start$/u);

    const session = await page.request.get("/api/auth/get-session");
    expect(await session.json()).toMatchObject({ user: { email: user.email } });

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
