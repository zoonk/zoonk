import { type APIResponse, type BrowserContext } from "@playwright/test";
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
 * Reads the single intercepted central-auth URL after Playwright has confirmed
 * that the login page made exactly one auth request.
 */
function getInterceptedAuthUrl(authUrls: string[]): string {
  const authUrl = authUrls.at(0);

  if (!authUrl) {
    throw new Error("Expected login to request the central auth URL");
  }

  return authUrl;
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
  test("starts login with a state-bound callback", async ({ context, page }) => {
    const baseURL = getBaseURL();
    const authUrls: string[] = [];

    await page.route("**/auth/login**", async (route) => {
      authUrls.push(route.request().url());
      await route.fulfill({ body: "Auth app", contentType: "text/html", status: 200 });
    });

    await page.goto("/login");
    await expect.poll(() => authUrls.length).toBe(1);

    const authUrl = getInterceptedAuthUrl(authUrls);
    const callbackUrl = getRequiredSearchParam({ name: "redirectTo", url: authUrl });
    const state = getRequiredSearchParam({ name: "state", url: callbackUrl });
    const cookies = await context.cookies(baseURL);
    const stateCookie = cookies.find((cookie) => cookie.name === ONE_TIME_TOKEN_LOGIN_STATE_COOKIE);

    expect(stateCookie?.value).toBe(state);
  });

  test("starts login with a state-bound return path", async ({ context, page }) => {
    const baseURL = getBaseURL();
    const authUrls: string[] = [];
    const nextPath = "/b/ai/c/course/ch/chapter/l/lesson";

    await page.route("**/auth/login**", async (route) => {
      authUrls.push(route.request().url());
      await route.fulfill({ body: "Auth app", contentType: "text/html", status: 200 });
    });

    await page.goto(`/login?next=${encodeURIComponent(nextPath)}`);
    await expect.poll(() => authUrls.length).toBe(1);

    const authUrl = getInterceptedAuthUrl(authUrls);
    const callbackUrl = getRequiredSearchParam({ name: "redirectTo", url: authUrl });
    const state = getRequiredSearchParam({ name: "state", url: callbackUrl });
    const cookies = await context.cookies(baseURL);
    const stateCookie = cookies.find((cookie) => cookie.name === ONE_TIME_TOKEN_LOGIN_STATE_COOKIE);

    expect(new URL(callbackUrl).searchParams.get("next")).toBe(nextPath);
    expect(stateCookie?.value).toBe(state);
  });

  test("drops backslash-based network-path return targets when starting login", async ({
    context,
    page,
  }) => {
    const baseURL = getBaseURL();
    const authUrls: string[] = [];
    const unsafeNextPath = String.raw`/\\evil.example/path`;

    await page.route("**/auth/login**", async (route) => {
      authUrls.push(route.request().url());
      await route.fulfill({ body: "Auth app", contentType: "text/html", status: 200 });
    });

    await page.goto(`/login?next=${encodeURIComponent(unsafeNextPath)}`);
    await expect.poll(() => authUrls.length).toBe(1);

    const authUrl = getInterceptedAuthUrl(authUrls);
    const callbackUrl = getRequiredSearchParam({ name: "redirectTo", url: authUrl });
    const state = getRequiredSearchParam({ name: "state", url: callbackUrl });
    const cookies = await context.cookies(baseURL);
    const stateCookie = cookies.find((cookie) => cookie.name === ONE_TIME_TOKEN_LOGIN_STATE_COOKIE);

    expect(new URL(callbackUrl).searchParams.get("next")).toBeNull();
    expect(stateCookie?.value).toBe(state);
  });

  test("redirects to home and sets session on valid token", async ({ browser }) => {
    const baseURL = getBaseURL();
    const user = await createE2EUser(baseURL);
    const token = await generateOneTimeToken(baseURL, user);

    const ctx = await browser.newContext({ baseURL });
    const state = await createLoginState({ baseURL, context: ctx });
    const page = await ctx.newPage();

    await page.goto(
      `/auth/callback?state=${encodeURIComponent(state)}&token=${encodeURIComponent(token)}`,
    );

    await page.waitForURL(/\/$/u);

    await page.getByRole("button", { name: /user menu/iu }).click();
    await expect(page.getByText(/logout/iu)).toBeVisible();

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
