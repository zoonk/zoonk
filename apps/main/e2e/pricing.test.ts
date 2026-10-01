import { getFreePlanLimits, getPlusPlanLimits } from "@zoonk/core/entitlements/plan-limits";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { type Page, expect, test } from "./fixtures";

const PHONE_VIEWPORT = { height: 812, width: 375 };

/** The note under Plus's "Unlimited*" values, with Plus's one hard cap. */
function getFairUseNote() {
  return `*Unlimited for personal use, under our fair use policy. With Plus, you can start up to ${getPlusPlanLimits().newGoalsPerDay} new goals a day.`;
}

/**
 * The public pricing page: the plans in the public frame (no learning tabs or settings), with
 * trying it free as the next step.
 */
async function expectPublicPricing(page: Page) {
  await expect(page).toHaveURL(/\/pricing$/u);
  await expect(page.getByRole("heading", { level: 1, name: /learn anything/iu })).toBeVisible();
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

  test("on a phone, Pricing in the footer opens it with each feature above Free and Plus", async ({
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

    const tutor = page
      .getByRole("table", { name: "What's included in Free and Plus" })
      .getByRole("row", { name: /AI tutor/u });

    const feature = await tutor.getByRole("rowheader").boundingBox();
    const free = await tutor.getByRole("cell").first().boundingBox();

    expect(free?.y).toBeGreaterThanOrEqual((feature?.y ?? 0) + (feature?.height ?? 0));

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

    expect(horizontalOverflow).toBe(0);

    await context.close();
  });

  test("compares the plans, lets people with an account log in to subscribe, and links fair use", async ({
    page,
  }) => {
    const limits = getFreePlanLimits();
    await page.goto("/pricing");

    const plans = page.getByRole("table", { name: "What's included in Free and Plus" });
    await expect(plans).toBeVisible();
    await expectAccessibleScreen(page, "the pricing page");

    await expect(
      plans
        .getByRole("row", { name: /active goals/iu })
        .getByRole("cell")
        .last(),
    ).toHaveText("Unlimited*");

    await expect(plans.getByRole("row", { name: /new lessons/iu }).getByRole("cell")).toHaveText([
      `${limits.lessonsPerDay} a day, ${limits.lessonsPerMonth} a month`,
      "Unlimited*",
    ]);

    await expect(
      plans
        .getByRole("row", { name: /AI tutor/u })
        .getByRole("cell")
        .last(),
    ).toHaveText("Unlimited*");

    await expect(page.getByText(getFairUseNote())).toBeVisible();

    await expect(plans.getByRole("row", { name: /exam prep/iu }).getByRole("cell")).toHaveText([
      "Diagnostic, plan and the first week",
      "Everything, including mock exams",
    ]);

    await expect(
      page.getByText(`No account yet? You can try ${limits.guestLessons} lessons first.`),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "Log in to subscribe" })).toHaveAttribute(
      "href",
      "/login?next=%2Fsubscription",
    );

    await expect(page.getByRole("button", { name: /monthly/iu })).toBeVisible();
    await expect(page.getByRole("button", { name: /yearly/iu })).toBeVisible();
    await expect(page.getByRole("button", { name: /^subscribe$/iu })).toHaveCount(0);

    await page.getByText(getFairUseNote()).getByRole("link", { name: "fair use policy" }).click();

    await expect(page).toHaveURL(/\/terms#fair-use$/u);
    await expect(page.getByRole("heading", { level: 2, name: "6. Fair use" })).toBeInViewport();
  });
});
