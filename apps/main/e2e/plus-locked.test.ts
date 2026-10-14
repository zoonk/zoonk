import { type Browser, type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EPersona } from "@zoonk/e2e/fixtures/personas";
import { expect, test } from "./fixtures";
import { openUserAsGuest } from "./guest-session";
import { openPersona } from "./learn-personas";

type Plan = "free" | "guest" | "plus";

/**
 * The day of Ana's plan whose week holds her first mock: an exam plan's mocks begin on the event
 * day of its second week, and at her 45 minutes a day they come every few weeks after that.
 */
const FIRST_MOCK_WEEK_DAY = 8;

/**
 * A private copy of the exam persona (Ana, ENEM, mocks in her plan) in the week of her first mock,
 * on the plan the test asks for: Plus as seeded, the free plan without her subscription, or a
 * guest without an account.
 */
async function openExamLearner(browser: Browser, plan: Plan) {
  const user = await createE2EPersona(getBaseURL(), { day: FIRST_MOCK_WEEK_DAY, persona: "exam" });

  if (plan === "plus") {
    return openPersona(browser, user);
  }

  await prisma.subscription.deleteMany({ where: { referenceId: user.id } });

  return plan === "guest" ? openUserAsGuest(browser, user) : openPersona(browser, user);
}

/**
 * What a learner without Plus sees on Today: the week names the mock's day for what their plan
 * makes it, a full review of every topic, and the mocks stay in sight, locked, under practice.
 */
async function expectLockedMocksOnToday(page: Page) {
  // Practice anytime is the phone/tablet entry; wider screens use the sidebar and palette.
  await page.setViewportSize({ height: 860, width: 820 });
  await page.goto("/today");

  const week = page.getByRole("region", { name: "This week" });

  await expect(week.getByText(/^Full review$/u)).toBeVisible();
  await expect(week.getByText(/mock exam/iu)).toHaveCount(0);

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
    mocks.getByRole("link", { name: /^(?<size>Half the exam|Full exam).*Available with Plus/u }),
  ).toHaveAttribute("href", /^\/challenge\/[\da-f-]{36}$/u);

  await expect(
    page.getByRole("link", { name: /^Take a mock exam.*Available with Plus$/u }),
  ).toBeVisible();

  await expect(
    mocks.getByText(
      "Mock exams come with Plus: whenever you want, every week in your plan, and your progress over time.",
    ),
  ).toBeVisible();

  await expect(page.getByRole("link", { name: "See Plus" })).toHaveCount(1);

  await expect(mocks.getByRole("link", { name: "See Plus" })).toHaveAttribute(
    "href",
    "/subscription",
  );
}

test.describe("Plus features are never hidden", () => {
  test("a free learner sees the exam's mocks locked on Today, the Plan and the exam page, each opening what Plus unlocks", async ({
    browser,
  }) => {
    const { context, page } = await openExamLearner(browser, "free");

    await expectLockedMocksOnToday(page);
    await expectAccessibleScreen(page, "Today with locked mocks");
    await page.setViewportSize({ height: 900, width: 1440 });

    // The Plan keeps her mocks, marked Plus: her next one opens the exam page, and a phase ahead
    // counts its own.
    await page.goto("/plan");

    await expect(
      page
        .getByRole("region", { name: "Next on your path" })
        .getByRole("link", { name: /^Mock exam.*Available with Plus/u }),
    ).toHaveAttribute("href", "/exam");

    await page
      .getByRole("region", { exact: true, name: "Phases" })
      .locator('[data-slot="roadmap-band"]')
      .nth(1)
      .click();

    // Its mocks (the next one, or how many it holds) are marked Plus too.
    const ahead = page.getByRole("dialog", { name: "Fill the gaps" });

    await expect(
      ahead
        .getByRole("listitem")
        .filter({ hasText: /mock exam/iu })
        .first(),
    ).toContainText("Available with Plus");

    await page.keyboard.press("Escape");

    await expectLockedMocksOnExamPage(page);
    await expectAccessibleScreen(page, "the exam page with locked mocks");

    // With the keyboard, the next mock opens its intro, which says what Plus unlocks: "See Plus"
    // is its one action, never a start that would be refused.
    const next = page.getByRole("link", { name: /^(?<size>Half the exam|Full exam)/u });
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

    for (const path of ["/today", "/plan", "/exam"]) {
      // oxlint-disable-next-line no-await-in-loop -- One page after another, in one browser.
      await page.goto(path);
      // oxlint-disable-next-line no-await-in-loop -- Checked once the page is there.
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // oxlint-disable-next-line no-await-in-loop -- Checked once the page is there.
      await expect(page.getByText("Available with Plus")).toHaveCount(0);
    }

    await expect(
      page.getByRole("link", { name: /^(?<size>Half the exam|Full exam)/u }),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: /^Take a mock exam/u })).toBeVisible();

    await context.close();
  });
});
