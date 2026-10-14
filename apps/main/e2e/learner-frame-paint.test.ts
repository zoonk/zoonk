import { type BrowserContext, type Page } from "@playwright/test";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { expect, test } from "./fixtures";

/** Main's session hint (`SESSION_HINT_COOKIE` in `apps/main/src/lib/learner/session-hint.ts`). */
const SESSION_HINT_COOKIE = "zoonk-signed-in";

/** Every placeholder that pulses while something loads. */
const SKELETONS = '[data-slot="skeleton"], [data-slot="avatar-skeleton"]';

async function getSessionHint(context: BrowserContext): Promise<string | null> {
  const cookies = await context.cookies();
  return cookies.find((cookie) => cookie.name === SESSION_HINT_COOKIE)?.value ?? null;
}

/** A learner on a planned goal, as most who open the catalog are. */
async function createGoalLearner() {
  const user = await createE2EUser(getBaseURL());

  const goal = await goalFixture({
    timezone: "UTC",
    title: "Bake sourdough bread",
    userId: user.id,
  });

  await Promise.all([
    planFixture({ goalId: goal.id }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  return user;
}

function sidebar(page: Page) {
  return page.getByRole("complementary", { name: "Sidebar" });
}

/**
 * Holds the browser's read of the learner summary until `release`, so the frame stays as the page
 * painted it: what the static page shows before the browser knows who's there.
 */
async function holdSummaryRead(page: Page) {
  const held = Promise.withResolvers<null>();
  const sent = Promise.withResolvers<null>();

  await page.route("**/api/learner/summary", async (route) => {
    sent.resolve(null);
    await held.promise;
    await route.continue();
  });

  return {
    release: async () => {
      await sent.promise;
      held.resolve(null);
    },
    sent: sent.promise,
  };
}

/**
 * Notes, on every frame from the first paint, whether a visitor's "Log in" was in sight anywhere
 * (`globalThis.sawLogin`), so a check after the summary arrived covers the whole load.
 */
async function watchForLogin(page: Page) {
  await page.addInitScript(() => {
    const seen = globalThis as unknown as { sawLogin: boolean };
    seen.sawLogin = false;

    function check() {
      const links = document.querySelectorAll("a");

      seen.sawLogin ||= [...links].some(
        (link) => link.textContent?.trim() === "Log in" && link.checkVisibility(),
      );

      requestAnimationFrame(check);
    }

    requestAnimationFrame(check);
  });
}

function sawLogin(page: Page): Promise<boolean> {
  return page.evaluate(() => (globalThis as unknown as { sawLogin: boolean }).sawLogin);
}

/** The sidebar's top (goal and search) and foot (the account), where they sit on the screen. */
async function frameBoxes(page: Page) {
  const [header, footer] = await Promise.all([
    page.locator('[data-slot="learn-sidebar-header"]').boundingBox(),
    page.locator('[data-slot="learn-sidebar-footer"]').boundingBox(),
  ]);

  return { footer, header };
}

async function openCatalog(context: BrowserContext) {
  const page = await context.newPage();
  await page.setViewportSize({ height: 900, width: 1440 });
  return page;
}

test.describe("Learner frame before the summary", () => {
  test("paints a visitor's frame on a static page, with nothing loading", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await openCatalog(context);
    const read = await holdSummaryRead(page);

    await page.goto("/courses");
    await read.sent;

    await expect(sidebar(page).getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: "Pricing" })).toBeVisible();
    await expect(sidebar(page).getByRole("link", { exact: true, name: "Zu" })).toBeVisible();
    await expect(page.locator(SKELETONS)).toHaveCount(0);

    await read.release();
    await expect.poll(() => getSessionHint(context)).toBe("0");
    await expect(sidebar(page).getByRole("link", { name: "Log in" })).toBeVisible();

    await context.close();
  });

  test("never shows a learner a visitor's way in or a skeleton while their summary is read", async ({
    browser,
  }) => {
    const user = await createGoalLearner();
    const context = await browser.newContext({ storageState: user.storageState });
    const page = await openCatalog(context);

    await watchForLogin(page);
    const read = await holdSummaryRead(page);

    await page.goto("/courses");
    await read.sent;

    // Painted from the hint alone: the account's quiet place, no way in, nothing pulsing.
    await expect(sidebar(page).getByRole("link", { name: "Log in" })).toBeHidden();
    await expect(sidebar(page).getByRole("link", { name: "Pricing" })).toBeHidden();
    await expect(sidebar(page).getByRole("link", { exact: true, name: "Buddy" })).toBeAttached();
    await expect(page.locator(SKELETONS)).toHaveCount(0);

    const before = await frameBoxes(page);

    await read.release();

    const goalMenu = sidebar(page).getByRole("button", { name: /Bake sourdough bread/u });
    await expect(goalMenu).toBeVisible();
    await expect(sidebar(page).getByRole("button", { name: /User menu$/u })).toBeVisible();

    // The learner's own goal and account fill the places the page kept for them.
    await expect.poll(() => frameBoxes(page)).toStrictEqual(before);
    await expect.poll(() => sawLogin(page)).toBe(false);

    await context.close();
  });

  test("keeps a learner's phone bars free of a visitor's way in while their summary is read", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());
    const context = await browser.newContext({ storageState: user.storageState });
    const page = await context.newPage();
    await page.setViewportSize({ height: 844, width: 390 });

    await watchForLogin(page);
    const read = await holdSummaryRead(page);

    await page.goto("/courses");
    await read.sent;

    await expect(page.locator(SKELETONS)).toHaveCount(0);

    const tabs = page.getByRole("navigation", { name: "Learning tabs" });
    const before = await tabs.boundingBox();

    await read.release();
    await expect(page.getByRole("button", { name: "User menu" })).toBeVisible();

    await expect.poll(() => tabs.boundingBox()).toStrictEqual(before);
    await expect.poll(() => sawLogin(page)).toBe(false);

    await context.close();
  });

  test("shows the visitor's frame once the summary says a hint's session ended", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    await context.addCookies([{ name: SESSION_HINT_COOKIE, url: getBaseURL(), value: "1" }]);

    const page = await openCatalog(context);
    const read = await holdSummaryRead(page);

    await page.goto("/courses");
    await read.sent;

    await expect(sidebar(page).getByRole("link", { name: "Log in" })).toBeHidden();

    await read.release();

    await expect(sidebar(page).getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: "Pricing" })).toBeVisible();
    await expect.poll(() => getSessionHint(context)).toBe("0");

    await context.close();
  });
});
