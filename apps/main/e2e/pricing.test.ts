import { getFreePlanLimits } from "@zoonk/core/entitlements/plan-limits";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { type Page, expect, test } from "./fixtures";

const PHONE_VIEWPORT = { height: 812, width: 375 };

/**
 * The public pricing page: the plans in the public frame (no learning tabs or settings), with
 * getting Plus as the offer's next step and starting free beside it.
 */
async function expectPublicPricing(page: Page) {
  await expect(page).toHaveURL(/\/pricing$/u);

  await expect(
    page.getByRole("heading", { level: 1, name: "Start free. Plus when you want everything." }),
  ).toBeVisible();

  await expect(
    page
      .getByRole("region", { exact: true, name: "Free" })
      .getByRole("link", { name: "Start free" }),
  ).toHaveAttribute("href", "/start");

  await expect(page.getByRole("navigation", { name: "Footer" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Settings" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Today" })).toHaveCount(0);
}

test.describe("Pricing for visitors", () => {
  test("the footer opens the page in another language, and back in English", async ({ page }) => {
    await page.goto("/pricing");
    const languages = page.getByRole("navigation", { name: "Language" });

    await expect(languages.getByRole("link", { name: "English" })).toHaveAttribute(
      "aria-current",
      "true",
    );

    await languages.getByRole("link", { name: "Português" }).click();
    await expect(page).toHaveURL(/\/pt\/pricing$/u);
    await expect(page.locator("html")).toHaveAttribute("lang", "pt");

    // The unprefixed address follows the last language picked, so English is picked back too.
    await page
      .getByRole("navigation", { name: "Idioma" })
      .getByRole("link", { name: "English" })
      .click();

    await expect(page).toHaveURL(/\/pricing$/u);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("Pricing in the home page's top bar opens the public pricing page", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByRole("banner");

    await expect(banner.getByRole("link", { name: "Start free" })).toHaveAttribute(
      "href",
      "/start",
    );

    // The logo alone goes home, named by the brand it shows.
    await expect(banner.getByRole("link", { exact: true, name: "Zoonk" })).toHaveAttribute(
      "href",
      "/",
    );

    await expect(banner).not.toContainText("Zoonk");

    // Courses and Pricing are the bar's page links: the section menus stay gone.
    await expect(banner.getByRole("link", { name: "Courses" })).toHaveAttribute("href", "/courses");
    await expect(banner.getByRole("link", { name: "How it works" })).toHaveCount(0);
    await expect(banner.getByRole("link", { name: "Mock exams" })).toHaveCount(0);

    await banner.getByRole("link", { name: "Pricing" }).click();

    await expectPublicPricing(page);
  });

  test("on a phone, Pricing in the footer opens it with the free plan first, then Plus", async ({
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

    // The free plan comes first, starting free on the first screen, then Plus with its own step.
    await expect(
      page
        .getByRole("region", { exact: true, name: "Free" })
        .getByRole("link", { name: "Start free" }),
    ).toBeInViewport();

    const plus = page.getByRole("region", { exact: true, name: "Plus" });
    await plus.scrollIntoViewIfNeeded();
    await expect(plus.getByRole("link", { name: "Get Plus" })).toBeVisible();

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

    // Plus keeps one action, and the page's last word offers it again beside starting free.
    const plus = page.getByRole("region", { exact: true, name: "Plus" });

    await expect(plus.getByRole("link", { name: "Get Plus" })).toHaveAttribute(
      "href",
      "/login?next=%2Fsubscription",
    );

    await expect(
      page.getByRole("region", { name: "Start free, no account needed." }).getByRole("link"),
    ).toHaveText(["Start free", "Get Plus"]);

    await expect(page.getByRole("button", { name: /^subscribe$/iu })).toHaveCount(0);

    // Without prices (this environment has no Stripe), checkout says the price and there's no
    // billing period to pick.
    await expect(plus.getByText("Price shown at checkout")).toBeVisible();
    await expect(plus.getByRole("radiogroup", { name: "Billing period" })).toHaveCount(0);

    // The free plan is a plan beside Plus, with starting free as its step.
    const freePlan = page.getByRole("region", { exact: true, name: "Free" });

    await expect(
      freePlan.getByText(`${limits.activeGoals} goal · ${limits.lessonsPerMonth} lessons a month`),
    ).toBeVisible();

    await expect(freePlan.getByRole("link", { name: "Start free" })).toHaveAttribute(
      "href",
      "/start",
    );

    // The free plan's limits come from the rules the allowance enforces; its question is open.
    const questions = page.getByRole("region", { name: "Common questions" });

    await expect(
      questions.getByText(`Start free with ${limits.guestLessons} lessons, no account needed.`),
    ).toBeVisible();

    await expect(questions.getByRole("listitem")).toHaveText([
      `${limits.activeGoals} goal at a time`,
      `${limits.lessonsPerMonth} lessons a month, up to ${limits.lessonsPerDay} a day`,
      "The first week of exam prep",
      `${limits.tutorMessagesPerDay} messages to your buddy and ${limits.uploadsPerDay} uploads a day`,
      "Practice calls, with lower limits than Plus (exam speaking tasks come with Plus)",
    ]);

    // No plan says how many minutes of calls it has.
    await expect(page.getByText(/minutes? of (?:speaking )?calls/iu)).toHaveCount(0);

    await questions.getByText("Can I get a refund?").click();

    await expect(questions.getByRole("link", { name: "contact us" })).toHaveAttribute(
      "href",
      "/support",
    );

    // Honest about the one thing Plus limits for people: speaking calls, without numbers.
    await questions.getByText("Is Plus really unlimited?").click();

    await expect(
      questions.getByText(
        "Speaking calls have daily and monthly limits, higher than on the free plan.",
        { exact: false },
      ),
    ).toBeVisible();

    await questions.getByRole("link", { name: "Read our fair use policy" }).click();

    await expect(page).toHaveURL(/\/terms#fair-use$/u);
    await expect(page.getByRole("heading", { level: 2, name: "6. Fair use" })).toBeInViewport();
  });

  test("prices the plans in the currency of the visitor's country, on a page load and after a client navigation", async ({
    browser,
  }) => {
    // Without the platform's country header, the country comes from the browser's language.
    const context = await browser.newContext({ locale: "pt-BR" });
    const page = await context.newPage();
    const currencyScope = page.locator("[data-billing-currency]").first();

    await page.goto("/pricing");
    await expect(page).toHaveURL(/\/pt\/pricing$/u);
    await expect(currencyScope).toHaveAttribute("data-billing-currency", "brl");

    const cookies = await context.cookies();
    expect(cookies.find((cookie) => cookie.name === "zoonk-country")?.value).toBe("BR");

    await page.goto("/pt/privacy");
    await page.getByRole("banner").getByRole("link", { name: "Preços" }).click();

    await expect(page).toHaveURL(/\/pt\/pricing$/u);
    await expect(currencyScope).toHaveAttribute("data-billing-currency", "brl");

    await context.close();
  });
});
