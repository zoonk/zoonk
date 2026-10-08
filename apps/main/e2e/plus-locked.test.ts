import { type Browser, type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EPersona } from "@zoonk/e2e/fixtures/personas";
import { expect, test } from "./fixtures";
import { openUserAsGuest } from "./guest-session";

type Plan = "free" | "guest" | "plus";

/**
 * A private copy of the exam persona (Ana, ENEM, weekly mocks in her plan) on the plan the test
 * asks for: Plus as seeded, the free plan without her subscription, or a guest without an account.
 */
async function openExamLearner(browser: Browser, plan: Plan) {
  const user = await createE2EPersona(getBaseURL(), { persona: "exam" });

  if (plan === "plus") {
    const context = await browser.newContext({ storageState: user.storageState });
    return { context, page: await context.newPage() };
  }

  await prisma.subscription.deleteMany({ where: { referenceId: user.id } });

  if (plan === "guest") {
    return openUserAsGuest(browser, user);
  }

  const context = await browser.newContext({ storageState: user.storageState });
  return { context, page: await context.newPage() };
}

/** The locked mocks a learner without Plus sees on Today: under the week and under practice. */
async function expectLockedMocksOnToday(page: Page) {
  await page.goto("/today");

  const week = page.getByRole("region", { name: "This week" });

  await expect(
    week.getByRole("link", { name: /^Mock exam .*Available with Plus$/u }),
  ).toBeVisible();

  const practice = page.getByRole("region", { name: "Practice anytime" });

  await expect(
    practice.getByRole("link", { name: /^Take a mock exam.*Available with Plus$/u }),
  ).toHaveAttribute("href", "/mock/new");

  // Today is opened every day: it marks what's locked and leaves the notice to the mock's pages.
  await expect(page.getByText("Mock exams come with Plus", { exact: false })).toHaveCount(0);
}

/**
 * The exam page shows its main action (a mock to take now) and the next mock as Plus learners see
 * them, marked Plus, with one notice of what Plus unlocks and its one way there.
 */
async function expectLockedMocksOnExamPage(page: Page) {
  await page.goto("/exam");

  const mocks = page.getByRole("region", { name: "Mock exams" });

  await expect(
    mocks.getByRole("link", { name: /^(?<size>Short version|Full exam).*Available with Plus/u }),
  ).toHaveAttribute("href", /^\/challenge\/[\da-f-]{36}$/u);

  await expect(
    page.getByRole("link", { name: /^Take a mock exam.*Available with Plus$/u }),
  ).toBeVisible();

  await expect(
    mocks.getByText("Mock exams come with Plus: whenever you want, and every week in your plan."),
  ).toBeVisible();

  await expect(page.getByRole("link", { name: "See Plus" })).toHaveCount(1);

  await expect(mocks.getByRole("link", { name: "See Plus" })).toHaveAttribute(
    "href",
    "/subscription",
  );
}

test.describe("Plus features are never hidden", () => {
  test("a free learner sees the exam's mocks locked on Today, the Journey and the exam page, each opening what Plus unlocks", async ({
    browser,
  }) => {
    const { context, page } = await openExamLearner(browser, "free");

    await expectLockedMocksOnToday(page);
    await expectAccessibleScreen(page, "Today with locked mocks");

    // The Journey's path keeps its mocks, marked Plus: the next one opens the exam page.
    await page.goto("/journey");

    const path = page.getByRole("list", { name: "Your journey" });
    const current = path.locator('li[aria-current="step"]');

    await expect(
      current.getByRole("link", { name: /^Mock exam.*Available with Plus/u }),
    ).toHaveAttribute("href", "/exam");

    await expect(
      path
        .locator('li[data-state="upcoming"]')
        .filter({ hasText: /\d+ mock exams?/u })
        .first(),
    ).toContainText("Available with Plus");

    await expectLockedMocksOnExamPage(page);
    await expectAccessibleScreen(page, "the exam page with locked mocks");

    // With the keyboard, the next mock opens its intro, which says what Plus unlocks: "See Plus"
    // is its one action, never a start that would be refused.
    const next = page.getByRole("link", { name: /^(?<size>Short version|Full exam)/u });
    await next.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/challenge\/[\da-f-]{36}$/u);

    // The exam page stays mounted, hidden, for the way back: only what's on screen counts.
    await expect(
      page
        .getByText("Mock exams come with Plus: whenever you want, and every week in your plan.")
        .filter({ visible: true }),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "See Plus" })).toHaveAttribute(
      "href",
      "/subscription",
    );

    await expect(page.getByRole("button", { name: /^Start/u })).toHaveCount(0);
    await expectAccessibleScreen(page, "a locked mock's intro");

    await context.close();
  });

  test("a guest sees the same locked mocks, and the Plus page asks them to create an account first", async ({
    browser,
  }) => {
    const { context, page } = await openExamLearner(browser, "guest");

    await expectLockedMocksOnToday(page);
    await expectLockedMocksOnExamPage(page);

    await page.getByRole("link", { name: "See Plus" }).click();
    await expect(page).toHaveURL(/\/subscription$/u);

    await expect(page.getByRole("link", { name: "Get Plus" })).toHaveAttribute(
      "href",
      "/login?next=%2Fsubscription",
    );

    await context.close();
  });

  test("a Plus learner sees the same mocks without any lock", async ({ browser }) => {
    const { context, page } = await openExamLearner(browser, "plus");

    for (const path of ["/today", "/journey", "/exam"]) {
      // oxlint-disable-next-line no-await-in-loop -- One page after another, in one browser.
      await page.goto(path);
      // oxlint-disable-next-line no-await-in-loop -- Checked once the page is there.
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // oxlint-disable-next-line no-await-in-loop -- Checked once the page is there.
      await expect(page.getByText("Available with Plus")).toHaveCount(0);
    }

    await expect(
      page.getByRole("link", { name: /^(?<size>Short version|Full exam)/u }),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: /^Take a mock exam/u })).toBeVisible();

    await context.close();
  });
});
