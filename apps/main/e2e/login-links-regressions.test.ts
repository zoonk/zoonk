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

// oxlint-disable-next-line vitest/prefer-each -- Playwright has no test.each API.
for (const { name, path } of [
  { name: "Log in", path: "/plan?from=sidebar" },
  { name: "Entrar", path: "/pt/settings/memory?from=sidebar" },
  { name: "Log in", path: "/start?goal=learn+physics" },
]) {
  test(`the static sidebar keeps ${path} before hydration`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    try {
      await mockCentralAuthTransport(page);
      const shell = await page.goto(path);
      expect(shell?.headers()["set-cookie"]).toBeUndefined();

      const login = page
        .getByRole("complementary", { name: /Sidebar|Barra lateral/u })
        .getByRole("link", { exact: true, name });

      // No scripts can replace Suspense's static fallback with the hydrated return address.
      await expect(login).toHaveAttribute("href", path.startsWith("/pt/") ? "/pt/login" : "/login");
      await login.click();
      await expect(page).toHaveURL(/\/auth\/login\?/u);

      const authUrl = new URL(page.url());
      const callbackUrl = new URL(authUrl.searchParams.get("redirectTo") ?? "");
      expect(callbackUrl.searchParams.get("next")).toBe(path);
    } finally {
      await context.close();
    }
  });
}

test("login recovers only same-origin learner pages when next is missing", async ({ request }) => {
  const baseURL = getBaseURL();

  await Promise.all(
    [
      "/plan?from=sidebar",
      "/pt/settings/memory",
      "/start?draft=unfinished",
      "/b/science/c/physics/ch/motion/l/velocity",
      "/learn/lesson-id",
    ].map(async (path) => {
      const response = await request.get("/login", {
        headers: { referer: new URL(path, baseURL).toString() },
        maxRedirects: 0,
      });

      expect(response.status()).toBe(307);
      const callbackUrl = new URL(getRedirectUrl(response).searchParams.get("redirectTo") ?? "");
      expect(callbackUrl.origin).toBe(new URL(baseURL).origin);
      expect(callbackUrl.searchParams.get("next")).toBe(path);
    }),
  );
});

test("login checks the browser origin selected by the deployment proxy", async ({ request }) => {
  await Promise.all(
    [
      { expected: "/plan?from=sidebar", referer: "https://preview.zoonk.dev/plan?from=sidebar" },
      { expected: "/today", referer: "http://preview.zoonk.dev/plan" },
      { expected: "/today", referer: "https://evil.example/plan" },
      { expected: "/today", referer: new URL("/plan", getBaseURL()).toString() },
    ].map(async ({ expected, referer }) => {
      const response = await request.get("/login", {
        headers: {
          referer,
          "x-forwarded-host": "preview.zoonk.dev, internal.example",
          "x-forwarded-proto": "https",
        },
        maxRedirects: 0,
      });

      const callbackUrl = new URL(getRedirectUrl(response).searchParams.get("redirectTo") ?? "");
      expect(callbackUrl.origin).toBe("https://preview.zoonk.dev");
      expect(callbackUrl.searchParams.get("next")).toBe(expected);
    }),
  );
});

test("login rejects unrelated, malformed, auth, and API referrers", async ({ request }) => {
  const baseURL = getBaseURL();

  await Promise.all(
    [
      "https://evil.example/plan",
      `${new URL(baseURL).origin.replace("http:", "https:")}/plan`,
      "//evil.example/plan",
      "/plan",
      "not a URL",
      ...[
        "/login",
        "/pt/login",
        "/auth/callback?next=/plan",
        "/pt/auth/login",
        "/api/auth/get-session",
        "/pt/api/auth/get-session",
        "/v1/auth/sign-out",
        "/pt/v1/auth/sign-out",
        "/plan/../auth/callback",
        "/plan/%2e%2e/api/auth/get-session",
        "//evil.example/plan",
        "/unknown-page",
      ].map((path) => new URL(path, baseURL).toString()),
    ].map(async (referer) => {
      const response = await request.get("/pt/login", { headers: { referer }, maxRedirects: 0 });

      expect(response.status()).toBe(307);
      const callbackUrl = new URL(getRedirectUrl(response).searchParams.get("redirectTo") ?? "");
      expect(callbackUrl.origin).toBe(new URL(baseURL).origin);
      expect(callbackUrl.searchParams.get("next"), referer).toBe("/pt/today");
    }),
  );
});

test("an explicit next takes precedence over the referrer, including an unsafe next", async ({
  request,
}) => {
  await Promise.all(
    [
      { expected: "/pt/plan?from=explicit", next: "/pt/plan?from=explicit" },
      { expected: "/pt/today", next: "https://evil.example" },
      { expected: "/pt/today", next: "//evil.example" },
      { expected: "/pt/today", next: String.raw`/\evil.example` },
      { expected: "/pt/today", next: "" },
    ].map(async ({ expected, next }) => {
      const response = await request.get(`/pt/login?${new URLSearchParams({ next })}`, {
        headers: { referer: new URL("/settings", getBaseURL()).toString() },
        maxRedirects: 0,
      });

      const callbackUrl = new URL(getRedirectUrl(response).searchParams.get("redirectTo") ?? "");
      expect(callbackUrl.searchParams.get("next")).toBe(expected);
    }),
  );
});

test("the sidebar logs in with one document request and returns to Plan", async ({ page }) => {
  const loginRequests: string[] = [];

  // Main's E2E server has no central-auth server. Stop at that external page; the real Main
  // callback below still redeems a real token with the state cookie written by this click.
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

test("settings login controls keep the localized return page on a phone", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/pt/settings/memory");
  const links = page.getByRole("link", { exact: true, name: "Entrar" });
  await expect(links).toHaveCount(2);

  const loginLinks = await links.all();

  await Promise.all(
    loginLinks.map((link) =>
      expect(link).toHaveAttribute("href", "/pt/login?next=%2Fpt%2Fsettings%2Fmemory"),
    ),
  );
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

  // Opening the Portuguese address doesn't change the saved language.
  const cookies = await context.cookies();
  expect(cookies.find((cookie) => cookie.name === LOCALE_COOKIE)?.value).toBe("de");

  const explicitEnglish = await context.request.get("/en", { maxRedirects: 0 });
  expect(getRedirectUrl(explicitEnglish).pathname).toBe("/today");
  await context.close();
});
