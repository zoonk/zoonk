import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expectAccessibleRoutes, expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";

const PATTERN_LINK = /We noticed a pattern\s*since e for/u;
const RENTING_UNIT = "Alugando um apartamento";

/** Picks an option with its number key, sees it was right, and continues with Enter. */
async function answerRightWithKeys(page: Page, key: string) {
  await page.keyboard.press(key);
  await expect(page.getByRole("status").filter({ hasText: /^Right!/u })).toBeVisible();
  await page.keyboard.press("Enter");
}

/** Answers the seeded "since e for" drill, the first one wrong, and checks the feedback. */
async function answerDrill(page: Page) {
  await expect(page.getByText("I've worked at the bank ___ 2019.")).toBeVisible();
  await page.keyboard.press("2");

  await expect(page.getByRole("status").filter({ hasText: /^Not quite\./u })).toContainText(
    "2019 é quando começou, então é since.",
  );

  await page.keyboard.press("Enter");

  await expect(page.getByText("We've lived here ___ three years.")).toBeVisible();
  await page.getByRole("button", { name: /for$/u }).click();
  await expect(page.getByRole("status").filter({ hasText: /^Right!/u })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await answerRightWithKeys(page, "2");
  await answerRightWithKeys(page, "2");
  await answerRightWithKeys(page, "1");
}

/**
 * "We noticed a pattern" for Marcos: from Today, beside his current situation, to the rule and its
 * contrast, then the five-question drill with instant feedback (number keys and Enter, or taps),
 * the result with Brain Power, and the card gone from Today once practiced.
 */
test.describe("Language mistake pattern", () => {
  test("drills the pattern from Today and takes it off Today, beside the current situation", async ({
    browser,
  }) => {
    await asPersona(browser, { mode: "focus", persona: "language" }, async ({ page }) => {
      await page.goto("/today");

      const situation = page.getByRole("region", { name: "Your current situation" });
      await expect(situation.getByText("Unit 2 of 6")).toBeVisible();
      await expect(situation.getByText("1 of 4 lessons")).toBeVisible();

      // No word he mispronounced is due, so Today asks him to say none again.
      await expect(page.getByRole("link", { name: /words? again/u })).toHaveCount(0);
      await expectAccessibleScreen(page, "Today for a language goal");

      await page.getByRole("link", { name: PATTERN_LINK }).click();

      await expect(page).toHaveURL(/\/pattern\/[\da-f-]{36}$/u);

      await expect(
        page.getByRole("heading", { level: 1, name: "We noticed a pattern" }),
      ).toBeVisible();

      await expect(page.getByText("I've lived here since 2020.")).toBeVisible();
      await expect(page.getByText("for 6 years")).toBeVisible();
      await expectAccessibleScreen(page, "a mistake pattern");

      await page.keyboard.press("Enter");
      await answerDrill(page);

      await expect(page.getByRole("heading", { level: 1, name: "4 of 5 right" })).toBeVisible();
      await expect(page.getByText(/^\+\d+ Brain Power$/u)).toBeVisible();

      await page.getByRole("link", { name: "Back to Today" }).click();

      await expect(page).toHaveURL(/\/today$/u);
      await expect(situation).toBeVisible();
      await expect(page.getByRole("link", { name: PATTERN_LINK })).toHaveCount(0);

      await situation.getByRole("link", { name: RENTING_UNIT }).click();

      await expect(page).toHaveURL(/\/content\/units\/[\da-f-]{36}$/u);
      await expect(page.getByRole("heading", { level: 1, name: RENTING_UNIT })).toBeVisible();
      await expectAccessibleScreen(page, "a unit");

      // No Focus flow opens a language goal's plan, so it's scanned here.
      await expectAccessibleRoutes(page, [{ path: "/plan" }]);
    });
  });

  test("a pattern that was only typos says so kindly, with nothing to practice", async ({
    browser,
  }) => {
    await asPersona(browser, { mode: "focus", persona: "language" }, async ({ page, user }) => {
      await prisma.mistakePattern.updateMany({
        data: { kind: "typos" },
        where: { userId: user.id },
      });

      await page.goto("/today");
      await page.getByRole("link", { name: /Just typos/u }).click();

      await expect(page.getByRole("heading", { level: 1, name: "Just typos" })).toBeVisible();
      await expect(page.getByRole("button", { name: /Practice this/u })).toHaveCount(0);

      // Reading the note is enough: it leaves Today.
      await page.getByRole("link", { name: "Done" }).click();
      await expect(page).toHaveURL(/\/today$/u);
      await expect(page.getByRole("region", { name: "Your current situation" })).toBeVisible();
      await expect(page.getByRole("link", { name: /Just typos/u })).toHaveCount(0);
    });
  });
});
