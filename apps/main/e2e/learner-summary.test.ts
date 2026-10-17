import { instant } from "@next/playwright";
import { type BrowserContext, type Page, request as apiRequest } from "@playwright/test";
import { ONE_TIME_TOKEN_LOGIN_STATE_COOKIE } from "@zoonk/core/auth/ott/state";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { type E2EUser, createE2EUser, generateOneTimeToken } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { mockCentralSignOut } from "./auth-transport";
import { openLearnerPalette, openPaletteWithKeyboard } from "./command-palette";
import { expect, test } from "./fixtures";
import { openAsGuest } from "./guest-session";
import { createMistakeLearner } from "./mistake-drill-days";
import { createStudyDay, saveMissions } from "./study-day";

const SESSION_HINT_COOKIE = "zoonk-signed-in";

/** The session hint's value in the browser: "1" for a session, "0" for none, null before any read. */
async function getSessionHint(context: BrowserContext): Promise<string | null> {
  const cookies = await context.cookies();
  return cookies.find((cookie) => cookie.name === SESSION_HINT_COOKIE)?.value ?? null;
}

/** A learner with two planned goals, on the first. */
async function createGoalLearner() {
  const user = await createE2EUser(getBaseURL());

  const [first, second] = await Promise.all([
    goalFixture({ timezone: "UTC", title: "Bake sourdough bread", userId: user.id }),
    goalFixture({ timezone: "UTC", title: "Learn to cook", userId: user.id }),
  ]);

  await Promise.all([
    planFixture({ goalId: first.id }),
    planFixture({ goalId: second.id }),
    learningProfileFixture({ activeGoalId: first.id, userId: user.id }),
  ]);

  const { name } = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

  return { first, name, second, user };
}

async function getUserName(user: E2EUser): Promise<string> {
  const { name } = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  return name;
}

async function openAs(context: BrowserContext, path: string) {
  const page = await context.newPage();
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto(path);
  return page;
}

/** The sidebar's goal switcher, named by the goal it shows. */
function goalSwitcher(page: Page, goal: string) {
  return sidebar(page).getByRole("button", { name: new RegExp(goal, "u") });
}

/**
 * Waits until the page took in the summary read it got last (its body consumed, a moment for the
 * store and a frame for React), so a later check sees whatever that read did.
 */
async function settle(page: Page) {
  await page.waitForFunction(() =>
    performance
      .getEntriesByType("resource")
      .some((entry) => new URL(entry.name).pathname === "/api/learner/summary"),
  );

  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(() => requestAnimationFrame(() => resolve()), 100);
      }),
  );
}

function sidebar(page: Page) {
  return page.getByRole("complementary", { name: "Sidebar" });
}

function accountRow(page: Page, name: string) {
  return sidebar(page).getByRole("button", { name: new RegExp(`^${name}`, "u") });
}

test.describe("learner summary", () => {
  test("answers a visitor without a session, never from an HTTP cache", async ({ request }) => {
    const response = await request.get("/api/learner/summary");

    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({ status: "visitor" });
  });

  test("reads the signed-in learner's summary without writing", async ({ browser }) => {
    const { first, user } = await createGoalLearner();
    const context = await browser.newContext({ storageState: user.storageState });

    const response = await context.request.get("/api/learner/summary");

    await expect(response.json()).resolves.toMatchObject({
      status: "ready",
      summary: { activeGoalId: first.id, identity: { isAnonymous: false, userId: user.id } },
    });

    await context.close();
  });

  test("draws the frame for a visitor, a guest and a learner", async ({ browser }) => {
    const visitorContext = await browser.newContext();
    const visitor = await openAs(visitorContext, "/courses");

    await expect(sidebar(visitor).getByRole("link", { name: "Log in" })).toBeVisible();

    const guest = await openAsGuest(browser);
    await guest.page.setViewportSize({ height: 900, width: 1440 });
    await guest.page.goto("/courses");

    await expect(accountRow(guest.page, "Guest")).toBeVisible();

    const { name, user } = await createGoalLearner();
    const learnerContext = await browser.newContext({ storageState: user.storageState });
    const learner = await openAs(learnerContext, "/today");

    await expect(goalSwitcher(learner, "Bake sourdough bread")).toBeVisible();
    await expect(accountRow(learner, name)).toBeVisible();

    await Promise.all([visitorContext.close(), guest.context.close(), learnerContext.close()]);
  });

  test("keeps the learner's frame on a client navigation, with nothing left loading", async ({
    browser,
  }) => {
    const { name, user } = await createGoalLearner();
    const context = await browser.newContext({ storageState: user.storageState });
    const page = await openAs(context, "/courses");

    await expect(accountRow(page, name)).toBeVisible();
    await page.waitForLoadState("networkidle");

    await instant(page, async () => {
      await sidebar(page).getByRole("link", { name: "Statistics" }).click();
      await page.waitForURL(/\/stats$/u);

      await expect(accountRow(page, name)).toBeVisible();
      await expect(goalSwitcher(page, "Bake sourdough bread")).toBeVisible();
      await expect(sidebar(page).locator('[data-slot="skeleton"]')).toHaveCount(0);
    });

    await context.close();
  });

  test("opens the palette for a visitor, a guest and a learner", async ({ browser }) => {
    const visitorContext = await browser.newContext();
    const visitor = await openAs(visitorContext, "/courses");
    const visitorPalette = await openPaletteWithKeyboard(visitor);

    await expect(visitorPalette.getByRole("option", { name: "Explore courses" })).toBeVisible();

    const guest = await openAsGuest(browser);
    await guest.page.goto("/courses");
    await expect(await openPaletteWithKeyboard(guest.page)).toBeVisible();

    const { user } = await createGoalLearner();
    const learnerContext = await browser.newContext({ storageState: user.storageState });
    const learner = await openAs(learnerContext, "/courses");
    // Asking the buddy lands above the highlighted row, so the learner's goals wait with it.
    const palette = await openLearnerPalette(learner);

    await expect(palette.getByRole("option", { name: "Switch to Learn to cook" })).toBeVisible();

    await Promise.all([visitorContext.close(), guest.context.close(), learnerContext.close()]);
  });

  test("drops one learner's frame when another takes the session", async ({ browser }) => {
    const [first, second] = await Promise.all([createGoalLearner(), createE2EUser(getBaseURL())]);
    const secondName = await getUserName(second);
    const context = await browser.newContext({ storageState: first.user.storageState });
    const page = await openAs(context, "/courses");

    await expect(accountRow(page, first.name)).toBeVisible();

    await signInAs({ context, user: second });
    const other = await openAs(context, "/today");
    await expect(accountRow(other, secondName)).toBeVisible();

    await expect(accountRow(page, secondName)).toBeVisible();
    await expect(page.getByText(first.name)).toHaveCount(0);
    await expect(page.getByText("Bake sourdough bread")).toHaveCount(0);

    await context.close();
  });

  test("never writes the session hint, for a session or one that ended", async ({ browser }) => {
    const { user } = await createGoalLearner();
    const context = await browser.newContext({ storageState: user.storageState });
    const tag = await getSessionHint(context);

    const ready = await context.request.get("/api/learner/summary");

    // The session ends (signed out elsewhere, or expired): the read says "visitor", and the hint
    // still changes only with the session cookie, which this read doesn't touch.
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await context.clearCookies({ name: /session_data/u });

    const ended = await context.request.get("/api/learner/summary");

    await expect(ended.json()).resolves.toMatchObject({ status: "visitor" });

    for (const response of [ready, ended]) {
      expect(response.headers()["set-cookie"] ?? "", response.url()).not.toContain(
        SESSION_HINT_COOKIE,
      );
    }

    expect(tag).toMatch(/^t1\.[\w-]{22}$/u);
    expect(await getSessionHint(context)).toBe(tag);

    // Asking auth itself finds the session gone: its response deletes the session cookie and
    // says "none" with it.
    const checked = await context.request.get(
      "/api/auth/get-session?disableCookieCache=true&disableRefresh=true",
    );

    const cookies = checked.headers()["set-cookie"] ?? "";

    expect(checked.headers()["x-zoonk-session-hint"]).toBe("0");
    expect(cookies).toMatch(/session_token=;/u);
    expect(cookies).toContain(`${SESSION_HINT_COOKIE}=0`);
    expect(await getSessionHint(context)).toBe("0");

    await context.close();
  });

  test("gives a session from before the hint its frame on the catalog, writing no hint", async ({
    browser,
  }) => {
    const { name, user } = await createGoalLearner();

    const storageState = {
      ...user.storageState,
      cookies: user.storageState.cookies.filter((cookie) => cookie.name !== SESSION_HINT_COOKIE),
    };

    const context = await browser.newContext({ storageState });
    const page = await openAs(context, "/courses");

    await expect(accountRow(page, name)).toBeVisible();

    // Only the auth responses that set the session cookie write the hint, beside it.
    expect(await getSessionHint(context)).toBeNull();

    await context.close();
  });

  test("asks once per page whether a visitor without a hint has a session, writing none", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const reads = { count: 0 };

    page.on("request", (request) => {
      if (request.url().endsWith("/api/learner/summary")) {
        reads.count += 1;
      }
    });

    // Each page shown reads once: nothing but an auth response may say "none" for the browser.
    await openAndRead(page, "/courses");
    await openAndRead(page, "/pricing");
    await openAndRead(page, "/courses");

    await expect(sidebar(page).getByRole("link", { name: "Log in" })).toBeVisible();
    expect(reads.count).toBe(3);
    expect(await getSessionHint(context)).toBeNull();

    await context.close();
  });

  test("gives a new guest the session hint, and their frame", async ({ browser }) => {
    const { lesson } = await playableLessonFixture();
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`/learn/${lesson.id}`);

    // The guest's own sign-in response names them in the hint.
    await expect.poll(() => getSessionHint(context)).toMatch(/^t1\.[\w-]{22}$/u);

    await expect
      .poll(() => context.request.get("/api/learner/summary").then((response) => response.json()))
      .toMatchObject({ status: "ready", summary: { identity: { isAnonymous: true } } });

    await context.close();
  });

  test("goes on as the guest a lesson makes for a visitor, without reloading the page", async ({
    browser,
  }) => {
    const { lesson } = await playableLessonFixture();
    const context = await browser.newContext();
    const page = await context.newPage();
    const loads = { count: 0 };

    page.on("load", () => {
      loads.count += 1;
    });

    await page.goto(`/learn/${lesson.id}`);

    // The tab's own guest: its sign-in names them in the hint, and the page simply goes on.
    await expect.poll(() => getSessionHint(context)).toMatch(/^t1\.[\w-]{22}$/u);

    await expect
      .poll(() => context.request.get("/api/learner/summary").then((response) => response.json()))
      .toMatchObject({ status: "ready", summary: { identity: { isAnonymous: true } } });

    await settle(page);

    expect(loads.count).toBe(1);
    await expect(page.getByText("This page is out of date")).toHaveCount(0);

    await context.close();
  });

  test("leaves a learner's page on its return once the server ended their session", async ({
    browser,
  }) => {
    const { name, user } = await createGoalLearner();
    const context = await browser.newContext({ storageState: user.storageState });
    const page = await openAs(context, "/plan");

    await expect(accountRow(page, name)).toBeVisible();
    await expect(planGoal(page)).toBeVisible();

    // The session ends on the server; the browser keeps its cookies and hint (no cached copy).
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await context.clearCookies({ name: /session_data/u });

    // The learner comes back to the tab: one session read, and its answer ends the page.
    await page.evaluate(() => {
      ["hidden", "visible"].forEach((state) => {
        Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
        document.dispatchEvent(new Event("visibilitychange"));
      });
    });

    await expect.poll(() => getSessionHint(context)).toBe("0");
    await expect(loginGate(page)).toBeVisible();
    await expect(planGoal(page)).toBeHidden();

    await context.close();
  });

  test("drops the session hint when the learner logs out", async ({ logoutPage }) => {
    await logoutPage.setViewportSize({ height: 900, width: 1440 });
    await logoutPage.goto("/settings");

    const account = sidebar(logoutPage).getByRole("button", { name: /User menu$/u });
    await account.click();

    await Promise.all([
      logoutPage.waitForEvent("framenavigated", {
        predicate: (frame) => frame === logoutPage.mainFrame(),
      }),
      logoutPage.getByRole("menuitem", { name: "Log out" }).click(),
    ]);

    expect(await getSessionHint(logoutPage.context())).toBe("0");
  });

  test("never puts the session hint or the session on static pages", async ({
    browser,
    request,
  }) => {
    const { user } = await createGoalLearner();
    const learner = await browser.newContext({ storageState: user.storageState });

    const responses = await Promise.all([
      ...["/", "/pricing", "/privacy", "/terms", "/courses"].map((path) =>
        request.get(path, { maxRedirects: 0 }),
      ),
      ...["/pricing", "/privacy", "/terms", "/courses"].map((path) =>
        learner.request.get(path, { maxRedirects: 0 }),
      ),
    ]);

    for (const response of responses) {
      const cookies = response.headers()["set-cookie"] ?? "";

      expect(cookies, response.url()).not.toContain(SESSION_HINT_COOKIE);
      expect(cookies, response.url()).not.toContain("session_token");
    }

    await learner.close();
  });

  test("never lets a read sent before another learner took the session win", async ({
    browser,
  }) => {
    const [first, second] = await Promise.all([createGoalLearner(), createE2EUser(getBaseURL())]);
    const secondName = await getUserName(second);
    const context = await browser.newContext({ storageState: first.user.storageState });
    const page = await context.newPage();
    await page.setViewportSize({ height: 900, width: 1440 });

    // The first read of this tab (sent with the first learner's cookies) is held back.
    const held = Promise.withResolvers<boolean>();
    const reads = { count: 0 };

    await page.route("**/api/learner/summary", async (route) => {
      reads.count += 1;

      if (reads.count === 1) {
        // The server answers it now, for the first learner; the browser only gets it later.
        const response = await route.fetch();
        await held.promise;
        await route.fulfill({ response });
        return;
      }

      await route.continue();
    });

    await page.goto("/courses");
    await expect.poll(() => reads.count).toBe(1);

    // Another tab signs in as someone else before that read answers.
    await signInAs({ context, user: second });
    const other = await openAs(context, "/today");
    await expect(accountRow(other, secondName)).toBeVisible();

    held.resolve(true);

    await expect(accountRow(page, secondName)).toBeVisible();
    await expect(page.getByText(first.name)).toHaveCount(0);

    await context.close();
  });

  test("never lets a read sent before the page's own summary win, with no tab telling", async ({
    browser,
  }) => {
    const [first, second] = await Promise.all([createGoalLearner(), createGoalLearner()]);
    const context = await browser.newContext({ storageState: first.user.storageState });
    const page = await context.newPage();
    await page.setViewportSize({ height: 900, width: 1440 });

    // The catalog's read (sent with the first learner's cookies) is held back.
    const held = Promise.withResolvers<boolean>();
    const answered = Promise.withResolvers<boolean>();
    const reads = { count: 0 };

    await page.route("**/api/learner/summary", async (route) => {
      reads.count += 1;

      if (reads.count === 1) {
        // The server answers it now, for the first learner; the browser only gets it later, or
        // never once the page it was sent from reloaded for the second learner.
        const response = await route.fetch();
        await held.promise;

        await route.fulfill({ response }).then(
          () => answered.resolve(true),
          () => answered.resolve(false),
        );

        return;
      }

      await route.continue();
    });

    // Today's link is ready for a client navigation once its prefetch landed.
    const prefetched = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/today" && response.request().headers().rsc === "1",
    );

    await page.goto("/courses");
    await prefetched;
    await expect.poll(() => reads.count).toBe(1);

    // The session changes hands with no other tab to say so; Today's own summary shows who now.
    await signInAs({ context, user: second.user });

    await sidebar(page)
      .getByRole("link", { name: /^Today/u })
      .click();

    await page.waitForURL(/\/today$/u);
    await expect(accountRow(page, second.name)).toBeVisible();

    // Back on the catalog, which reads nothing itself, the old read finally answers.
    const catalogPalette = await openPaletteWithKeyboard(page);
    await catalogPalette.getByRole("combobox").fill("Explore courses");
    await catalogPalette.getByRole("option", { name: /^Explore courses/u }).click();
    await page.waitForURL(/\/courses$/u);

    held.resolve(true);
    await answered.promise;

    await expect(accountRow(page, second.name)).toBeVisible();
    await expect(page.getByText(first.name)).toHaveCount(0);

    await context.close();
  });

  test("counts the mistakes ready to practice in the sidebar and the palette, from the summary", async ({
    browser,
  }) => {
    const { user } = await createMistakeLearner({ causes: ["misread"] });
    const context = await browser.newContext({ storageState: user.storageState });
    const reads: string[] = [];

    // The page's own render brings the summary: nothing is read for the counts.
    context.on("request", (request) => {
      const { pathname } = new URL(request.url());

      if (pathname.startsWith("/api/learner/")) {
        reads.push(pathname);
      }
    });

    const page = await openAs(context, "/today");

    await expect(sidebar(page).getByRole("link", { name: /^Mistakes notebook/u })).toHaveText(
      "Mistakes notebook1",
    );

    const palette = await openPaletteWithKeyboard(page);

    await expect(palette.getByRole("option", { name: /^Practice your mistakes/u })).toContainText(
      "1",
    );

    await expect(palette.getByRole("option", { name: /^Mistakes notebook/u })).toContainText("1");
    expect(reads).toStrictEqual([]);

    await context.close();
  });

  test("keeps a visitor's palette to the app's frame, even once opened", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await openAs(context, "/courses");
    const palette = await openPaletteWithKeyboard(page);

    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();

    await sidebar(page).getByRole("link", { name: "Pricing" }).click();
    await page.waitForURL(/\/pricing$/u);

    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByRole("dialog", { name: "Search" })).toHaveCount(0);

    await context.close();
  });

  test("never shows a learner's missions ring to the visitor who follows them", async ({
    browser,
  }) => {
    const { session, user } = await createStudyDay({ buddy: true });

    await saveMissions(session.id, [
      { anchor: { blockKind: "learn" }, kind: "somethingNew", total: 1 },
    ]);

    const context = await browser.newContext({ storageState: user.storageState });
    const page = await openAs(context, "/today");

    await expect(sidebar(page).getByRole("link", { name: /missions today/u })).toBeVisible();
    const catalogPalette = await openPaletteWithKeyboard(page);
    await catalogPalette.getByRole("combobox").fill("Explore courses");
    await catalogPalette.getByRole("option", { name: /^Explore courses/u }).click();
    await page.waitForURL(/\/courses$/u);

    await logOutInAnotherTab(context);

    await expect(sidebar(page).getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: /missions today/u })).toHaveCount(0);

    await context.close();
  });

  test("gives a page back to the learner who signs in again in another tab", async ({
    browser,
  }) => {
    const { name, user } = await createGoalLearner();
    const context = await browser.newContext({ storageState: user.storageState });
    const page = await openAs(context, "/plan");
    const gate = loginGate(page);

    await expect(accountRow(page, name)).toBeVisible();
    await expect(gate).toHaveCount(0);

    // Logged out in another tab, the Plan asks the visitor to log in...
    await logOutInAnotherTab(context);
    await expect(gate).toBeVisible();

    // ...until the learner signs in again there: the Plan is theirs again, not only the frame.
    await signInInAnotherTab({ context, user });
    await expect(accountRow(page, name)).toBeVisible();
    await expect(gate).toBeHidden();
    await expect(planGoal(page)).toBeVisible();

    await context.close();
  });

  test("gives a page opened signed out to the learner who signs in in another tab", async ({
    browser,
  }) => {
    const { name, user } = await createGoalLearner();
    const context = await browser.newContext();
    const page = await openAs(context, "/plan");
    const gate = loginGate(page);

    await expect(gate).toBeVisible();

    await signInInAnotherTab({ context, user });
    await expect(accountRow(page, name)).toBeVisible();
    await expect(gate).toBeHidden();
    await expect(planGoal(page)).toBeVisible();

    await context.close();
  });
});

/** Opens `path` and waits for the summary read its page sends. */
async function openAndRead(page: Page, path: string) {
  const read = page.waitForResponse((response) => response.url().endsWith("/api/learner/summary"));

  await page.goto(path);
  await read;
}

/** The learner's goal in the Plan's body, which a signed-out Plan never names. */
function planGoal(page: Page) {
  return page
    .getByRole("main")
    .getByText(/Bake sourdough bread/u)
    .first();
}

/** A gated page's way in, where its body would be. */
function loginGate(page: Page) {
  return page.getByRole("main").getByRole("heading", { level: 2, name: "Log in to continue" });
}

/** Logs the learner out from another tab's account menu, as they would. */
async function logOutInAnotherTab(context: BrowserContext) {
  const other = await context.newPage();
  await mockCentralSignOut(other);
  await other.setViewportSize({ height: 900, width: 1440 });
  await other.goto("/settings");

  await sidebar(other)
    .getByRole("button", { name: /User menu$/u })
    .click();

  await Promise.all([
    other.waitForEvent("framenavigated", { predicate: (frame) => frame === other.mainFrame() }),
    other.getByRole("menuitem", { name: "Log out" }).click(),
  ]);
}

/**
 * Signs the learner in from another tab through the auth callback, as a real sign-in ends, with a
 * token from a new session of theirs (a logout ended the one they had).
 */
async function signInInAnotherTab({ context, user }: { context: BrowserContext; user: E2EUser }) {
  const auth = await apiRequest.newContext({ baseURL: getBaseURL() });

  const signIn = await auth.post("/api/auth/sign-in/email", {
    data: { email: user.email, password: user.password },
  });

  expect(signIn.ok()).toBe(true);
  const storageState = await auth.storageState();
  await auth.dispose();

  const token = await generateOneTimeToken(getBaseURL(), { ...user, storageState });
  const state = crypto.randomUUID();

  await context.addCookies([
    { name: ONE_TIME_TOKEN_LOGIN_STATE_COOKIE, sameSite: "Lax", url: getBaseURL(), value: state },
  ]);

  const other = await context.newPage();

  await other.goto(
    `/auth/callback?state=${encodeURIComponent(state)}&token=${encodeURIComponent(token)}`,
  );

  await other.waitForURL(/\/today$/u);
}

/** Replaces the context's session with another learner's, as signing in in another tab does. */
async function signInAs({ context, user }: { context: BrowserContext; user: E2EUser }) {
  await context.clearCookies();
  await context.addCookies(user.storageState.cookies);
}
