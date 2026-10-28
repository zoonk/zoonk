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

    // Hydration swaps in the link that returns here, and a tap across the swap is lost.
    const logIn = page.getByRole("link", { exact: true, name: "Log in" });
    await expect(logIn).toHaveAttribute("href", "/login?next=%2F");
    await logIn.click();
    await expect(page.getByLabel("Email")).toBeVisible();
    expect(documents.length).toBeLessThan(5);
  } finally {
    await context.close();
  }
});
