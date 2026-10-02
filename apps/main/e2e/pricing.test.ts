import { getFreePlanLimits } from "@zoonk/core/entitlements/plan-limits";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { type Page, expect, test } from "./fixtures";

const PHONE_VIEWPORT = { height: 812, width: 375 };

/**
 * The public pricing page: the plans in the public frame (no learning tabs or settings), with
 * trying it free as the next step.
 */
async function expectPublicPricing(page: Page) {
  await expect(page).toHaveURL(/\/pricing$/u);

  await expect(
    page.getByRole("heading", { level: 1, name: "Get ready for your exam, new job or move." }),
  ).toBeVisible();

  await expect(page.getByRole("link", { name: "Try free" })).toHaveAttribute("href", "/start");
  await expect(page.getByRole("navigation", { name: "Footer" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Settings" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Today" })).toHaveCount(0);
}

test.describe("Pricing for visitors", () => {
  test("Pricing in the home page's top bar opens the public pricing page", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("banner").getByRole("link", { name: "Try free" })).toHaveAttribute(
      "href",
      "/start",
    );

    await page
      .getByRole("navigation", { name: "Home page sections" })
      .getByRole("link", { name: "Pricing" })
      .click();

    await expectPublicPricing(page);
  });

  test("on a phone, Pricing in the footer opens it with the offer's next step on the first screen", async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: PHONE_VIEWPORT });
    const page = await context.newPage();

    await page.goto("/");

    await page
      .getByRole("navigation", { name: "Footer" })
      .getByRole("link", { name: "Pricing" })
      .click();

    await expectPublicPricing(page);
    await expect(page.getByRole("link", { name: "Try free" })).toBeInViewport();

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

    expect(horizontalOverflow).toBe(0);

    await context.close();
  });

  test("offers Plus, lets visitors sign in to get it, and answers common questions", async ({
    page,
  }) => {
    const limits = getFreePlanLimits();
    await page.goto("/pricing");

    await expect(page.getByRole("heading", { exact: true, level: 2, name: "Plus" })).toBeVisible();
    await expectAccessibleScreen(page, "the pricing page");

    await expect(page.getByRole("link", { name: "Get Plus" })).toHaveAttribute(
      "href",
      "/login?next=%2Fsubscription",
    );

    await expect(page.getByRole("button", { name: /monthly/iu })).toBeVisible();
    await expect(page.getByRole("button", { name: /yearly/iu })).toBeVisible();
    await expect(page.getByRole("button", { name: /^subscribe$/iu })).toHaveCount(0);

    const questions = page.getByRole("region", { name: "Common questions" });

    // The free plan's limits come from the rules the allowance enforces.
    await questions.getByText("What's in the free plan?").click();

    await expect(
      questions.getByText(`Try ${limits.guestLessons} lessons without an account.`),
    ).toBeVisible();

    await expect(questions.getByRole("listitem")).toHaveText([
      `${limits.activeGoals} goal at a time`,
      `${limits.lessonsPerDay} lessons a day, up to ${limits.lessonsPerMonth} a month`,
      "The first week of exam prep",
      `${limits.tutorMessagesPerDay} tutor messages, ${limits.conversationsPerDay} speaking conversations and ${limits.uploadsPerDay} uploads a day`,
    ]);

    await questions.getByText("Can I get a refund?").click();

    await expect(questions.getByRole("link", { name: "contact us" })).toHaveAttribute(
      "href",
      "/support",
    );

    await questions.getByText("Is Plus really unlimited?").click();
    await questions.getByRole("link", { name: "Read our fair use policy" }).click();

    await expect(page).toHaveURL(/\/terms#fair-use$/u);
    await expect(page.getByRole("heading", { level: 2, name: "6. Fair use" })).toBeInViewport();
  });
});
