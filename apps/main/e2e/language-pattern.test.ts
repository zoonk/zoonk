import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";

const PATTERN_LINK = /We noticed a pattern\s*“Since” e “for”/u;

/** Picks an option with its number key, sees it was right, and continues with Enter. */
async function answerRightWithKeys(page: Page, key: string) {
  await page.keyboard.press(key);
  await expect(page.getByRole("status").filter({ hasText: /^Right!/u })).toBeVisible();
  await page.keyboard.press("Enter");
}

/** Answers the seeded "“Since” e “for”" drill, the first one wrong, and checks the feedback. */
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
 * "We noticed a pattern" for Marcos: Today's one notice, under his plan's status, to the rule and its
 * contrast, then the five-question drill with instant feedback (number keys and Enter, or taps),
 * the result with Brain Power, and the row gone from Today once practiced.
 */
test.describe("Language mistake pattern", () => {
  test("drills the pattern from Today and takes it off Today", async ({ browser }) => {
    await asPersona(browser, { persona: "language" }, async ({ page }) => {
      await page.goto("/today");

      // Today says only where the plan stands: the level lives in the Journey.
      await expect(page.getByText(/level A\d|preparation \d+%/u)).toHaveCount(0);

      // No word he mispronounced is due, so Today asks him to say none again.
      await expect(page.getByRole("link", { name: /words? again/u })).toHaveCount(0);
      await expectAccessibleScreen(page, "Today for a language goal");

      await page.getByRole("link", { name: PATTERN_LINK }).click();

      await expect(page).toHaveURL(/\/pattern\/[\da-f-]{36}$/u);

      // The pattern is the title, under what it is.
      await expect(page.getByRole("heading", { level: 1, name: "“Since” e “for”" })).toBeVisible();

      await expect(
        page.getByRole("main").getByText("We noticed a pattern", { exact: true }),
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
      await expect(page.getByRole("region", { name: "Today's session" })).toBeVisible();
      await expect(page.getByRole("link", { name: PATTERN_LINK })).toHaveCount(0);
    });
  });

  test("a pattern that was only typos says so kindly, with nothing to practice", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "language" }, async ({ page, user }) => {
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
      await expect(page.getByRole("region", { name: "Today's session" })).toBeVisible();
      await expect(page.getByRole("link", { name: /Just typos/u })).toHaveCount(0);
    });
  });
});
