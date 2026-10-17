import { ONE_TIME_TOKEN_LOGIN_STATE_COOKIE } from "@zoonk/core/auth/ott/state";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser, generateOneTimeToken } from "@zoonk/e2e/fixtures/users";
import { mockCentralAuthTransport, mockCentralSignOut } from "./auth-transport";
import { expect, test } from "./fixtures";
import { createStudyDay } from "./study-day";

test("signing in with a real token lands a learner on an interactive Today", async ({
  browser,
}) => {
  const { user } = await createStudyDay();
  const baseURL = getBaseURL();
  const context = await browser.newContext({ baseURL });
  const initiated = await context.request.get("/login?next=%2Ftoday", { maxRedirects: 0 });
  const authUrl = new URL(initiated.headers().location ?? "");
  const callback = new URL(authUrl.searchParams.get("redirectTo") ?? "");
  callback.searchParams.set("token", await generateOneTimeToken(baseURL, user));
  const page = await context.newPage();

  try {
    await page.goto(callback.href);
    await expect(page).toHaveURL(/\/today$/u);
    await expect(page.getByRole("heading", { exact: true, name: "Today" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Start session/u })).toBeEnabled();
    await expect(page.getByRole("heading", { name: "This page didn't load" })).toHaveCount(0);
  } finally {
    await context.close();
  }
});

// oxlint-disable-next-line vitest/prefer-each -- Playwright has no test.each API.
for (const control of ["\t", "\n", "\r", "\u0000", "\u0008", "\u001F", "\u007F"]) {
  test(`ASCII control ${control.codePointAt(0)} stays in the app at login and successful redemption`, async ({
    browser,
  }) => {
    const baseURL = getBaseURL();
    const user = await createE2EUser(baseURL);
    const context = await browser.newContext({ baseURL });

    try {
      const next = `/${control}/evil.example`;

      const initiated = await context.request.get(`/login?${new URLSearchParams({ next })}`, {
        maxRedirects: 0,
      });

      expect(initiated.status()).toBe(307);
      const authUrl = new URL(initiated.headers().location ?? "");
      const callback = new URL(authUrl.searchParams.get("redirectTo") ?? "");
      expect(callback.searchParams.get("next")).toBe("/today");
      const state = callback.searchParams.get("state") ?? "";
      const cookies = await context.cookies();

      expect(
        cookies.find((cookie) => cookie.name === ONE_TIME_TOKEN_LOGIN_STATE_COOKIE)?.value,
      ).toBe(state);

      const token = await generateOneTimeToken(baseURL, user);

      const redeemed = await context.request.get(
        `/auth/callback?${new URLSearchParams({ next, state, token })}`,
        { maxRedirects: 0 },
      );

      expect(redeemed.status()).toBe(302);
      expect(redeemed.headers().location).toBe("/");
    } finally {
      await context.close();
    }
  });
}

test("a second failed callback renders a retry screen with a safe return path", async ({
  page,
}) => {
  const response = await page.goto("/auth/callback?error=auth&token=invalid&next=%2Fplan");
  expect(response?.status()).toBe(401);
  await expect(page.getByRole("heading", { name: "We couldn't sign you in." })).toBeVisible();

  await expect(page.getByRole("link", { name: "Try again" })).toHaveAttribute(
    "href",
    "/login?next=%2Fplan",
  );

  await expect(page).toHaveURL(/\/auth\/callback\?/u);
});

test("logout ends the app session and signs out centrally before login can reopen", async ({
  browser,
}) => {
  const baseURL = getBaseURL();
  const user = await createE2EUser(baseURL);
  const context = await browser.newContext({ baseURL, storageState: user.storageState });
  const page = await context.newPage();
  const centralSignOut = await mockCentralSignOut(page);
  const documents: string[] = [];

  await mockCentralAuthTransport(page);

  try {
    await page.goto("/settings");
    await page.getByRole("button", { name: /User menu$/u }).click();
    await page.getByRole("menuitem", { exact: true, name: "Log out" }).click();
    await expect(page).toHaveURL(new URL("/", baseURL).href);
    expect(centralSignOut).toEqual(["POST"]);

    const session = await context.request.get("/api/auth/get-session", {
      params: { disableCookieCache: true },
    });

    expect(await session.json()).toBeNull();

    page.on("request", (request) => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        documents.push(request.url());
      }
    });

    await page.getByRole("link", { exact: true, name: "Log in" }).click();
    await expect(page.getByLabel("Email")).toBeVisible();
    expect(documents.length).toBeLessThan(5);
  } finally {
    await context.close();
  }
});
