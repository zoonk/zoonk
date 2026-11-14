import { type APIResponse, type Response } from "@playwright/test";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser, generateOneTimeToken } from "@zoonk/e2e/fixtures/users";
import { LOCALE_COOKIE } from "@zoonk/utils/locale";
import { mockCentralAuthTransport } from "./auth-transport";
import { expect, test } from "./fixtures";

function getRedirectUrl(response: APIResponse | Response): URL {
  const location = response.headers().location;

  if (!location) {
    throw new Error("Expected a redirect with a Location header");
  }

  return new URL(location, response.url());
}

test("the sidebar logs in with one document request and returns to Plan", async ({ page }) => {
  const loginRequests: string[] = [];

  // Main's E2E server has no central-auth server, so this stops at that external page.
  await mockCentralAuthTransport(page);
  await page.goto("/plan");

  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/login") {
      loginRequests.push(request.resourceType());
    }
  });

  const loginResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/login",
  );

  await page
    .getByRole("complementary", { name: "Sidebar" })
    .getByRole("link", { exact: true, name: "Log in" })
    .click();

  const response = await loginResponse;
  await expect(page).toHaveURL(/\/auth\/login\?/u);
  expect(loginRequests).toEqual(["document"]);

  const authUrl = getRedirectUrl(response);
  const callbackUrl = new URL(authUrl.searchParams.get("redirectTo") ?? "");
  expect(callbackUrl.searchParams.get("next")).toBe("/plan");

  const user = await createE2EUser(getBaseURL());
  callbackUrl.searchParams.set("token", await generateOneTimeToken(getBaseURL(), user));
  await page.goto(callbackUrl.toString());
  await expect(page).toHaveURL(/\/plan$/u);
});

test("a task page outside the app's frame offers a visitor to log in or build a plan", async ({
  page,
}) => {
  await page.goto("/pronunciation");

  await expect(page.getByRole("heading", { level: 1, name: "Log in to continue" })).toBeVisible();

  await expect(page.getByRole("link", { exact: true, name: "Log in" })).toHaveAttribute(
    "href",
    `/login?next=${encodeURIComponent("/pronunciation")}`,
  );

  await expect(page.getByRole("link", { exact: true, name: "Build my plan" })).toHaveAttribute(
    "href",
    "/start",
  );
});

test("a learner whose login ended is offered only to log in, not a new plan", async ({ page }) => {
  await page
    .context()
    .addCookies([{ name: "better-auth.session_token", url: getBaseURL(), value: "ended" }]);

  await page.goto("/pronunciation");

  await expect(
    page.getByRole("heading", { level: 1, name: "You've been logged out" }),
  ).toBeVisible();

  await expect(page.getByRole("link", { exact: true, name: "Log in" })).toHaveAttribute(
    "href",
    `/login?next=${encodeURIComponent("/pronunciation")}`,
  );

  await expect(page.getByRole("link", { name: "Build my plan" })).toHaveCount(0);
});

test("signed-in home resolves browser, saved, and explicit locales in one redirect", async ({
  browser,
  noProgressUser,
}) => {
  const baseURL = getBaseURL();

  const context = await browser.newContext({
    baseURL,
    extraHTTPHeaders: { "accept-language": "pt-BR" },
    locale: "pt-BR",
    storageState: noProgressUser.storageState,
  });

  const browserLocale = await context.request.get("/?from=home", { maxRedirects: 0 });
  expect(browserLocale.status()).toBe(307);
  expect(getRedirectUrl(browserLocale).pathname).toBe("/pt/today");
  expect(getRedirectUrl(browserLocale).search).toBe("?from=home");

  const today = await context.request.get(getRedirectUrl(browserLocale).toString(), {
    maxRedirects: 0,
  });

  expect(today.status()).toBe(200);
  expect(today.headers().location).toBeUndefined();

  await context.addCookies([{ name: LOCALE_COOKIE, url: baseURL, value: "de" }]);
  const savedLocale = await context.request.get("/", { maxRedirects: 0 });
  expect(getRedirectUrl(savedLocale).pathname).toBe("/de/today");

  const explicitLocale = await context.request.get("/pt", { maxRedirects: 0 });
  expect(getRedirectUrl(explicitLocale).pathname).toBe("/pt/today");

  const cookies = await context.cookies();
  expect(cookies.find((cookie) => cookie.name === LOCALE_COOKIE)?.value).toBe("de");

  const explicitEnglish = await context.request.get("/en", { maxRedirects: 0 });
  expect(getRedirectUrl(explicitEnglish).pathname).toBe("/today");
  await context.close();
});
