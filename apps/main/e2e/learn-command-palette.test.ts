import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { type Page, expect, test } from "./fixtures";
import { asPersona, expectMode } from "./learn-personas";

/** Cmd/Ctrl+K from anywhere on the page, retried until the client has hydrated the shortcut. */
async function openPaletteWithKeyboard(page: Page) {
  const palette = page.getByRole("dialog", { name: "Search" });

  await expect(async () => {
    await page.keyboard.press("ControlOrMeta+k");
    await expect(palette).toBeVisible({ timeout: 1000 });
  }).toPass();

  return palette;
}

/**
 * The learning tabs' command palette: the same Cmd/Ctrl+K palette as the catalog, with the
 * learner's places in their mode's names, their other goals and "Send feedback".
 */
test.describe("Learning tabs command palette", () => {
  test("Focus lists the tabs by name and goes to one from the keyboard", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "exam" }, async ({ page }) => {
      await page.goto("/today");
      await expectMode(page, "focus");

      await expect(page.getByRole("button", { name: "Search" })).toHaveAttribute(
        "aria-keyshortcuts",
        "Meta+K Control+K",
      );

      const palette = await openPaletteWithKeyboard(page);
      const pages = palette.getByRole("group", { name: "Pages" });

      await expect(pages.getByRole("option")).toHaveText([
        "Today",
        "Plan",
        "Progress",
        "Content",
        "Mistakes notebook",
        "Explore courses",
        "Add a goal",
      ]);

      await palette.getByRole("combobox", { name: "Search" }).fill("plan");
      await page.keyboard.press("Enter");

      await expect(page).toHaveURL(/\/plan$/u);
      await expect(palette).toBeHidden();
    });
  });

  test("Fun names the places as its dock does, with the buddy and the logbook", async ({
    browser,
  }) => {
    await asPersona(browser, { mode: "fun", persona: "fun" }, async ({ page }) => {
      await page.goto("/today");
      await expectMode(page, "fun");

      await page.getByRole("button", { name: "Search" }).click();

      const pages = page
        .getByRole("dialog", { name: "Search" })
        .getByRole("group", { name: "Pages" });

      await expect(pages.getByRole("option")).toHaveText([
        "Today",
        "Route",
        "Cards",
        "Your buddy",
        "Progress",
        "Logbook",
        "Mistakes notebook",
        "Explore courses",
        "Add a goal",
      ]);

      await pages.getByRole("option", { name: "Cards" }).click();
      await expect(page).toHaveURL(/\/content$/u);
    });
  });

  test("switches to another goal from the palette", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "exam" }, async ({ page, user }) => {
      const second = await goalFixture({ title: "Learn to cook", userId: user.id });
      await planFixture({ goalId: second.id });

      await page.goto("/progress");
      await expectMode(page, "focus");

      const palette = await openPaletteWithKeyboard(page);
      const goals = palette.getByRole("group", { name: "Goals" });

      /** The goal on screen isn't offered: only the ones to switch to. */
      await expect(goals.getByRole("option")).toHaveText(["Switch to Learn to cook"]);

      await palette.getByRole("combobox", { name: "Search" }).fill("cook");
      await page.keyboard.press("Enter");

      await expect(palette).toBeHidden();

      await expect(
        page.getByRole("button", { name: /Current goal: Learn to cook/u }),
      ).toBeVisible();

      await expect
        .poll(async () => {
          const profile = await prisma.userLearningProfile.findUnique({
            where: { userId: user.id },
          });

          return profile?.activeGoalId;
        })
        .toBe(second.id);
    });
  });

  test(`"Send feedback" opens the feedback form`, async ({ browser }) => {
    await asPersona(browser, { mode: "fun", persona: "exam" }, async ({ page }) => {
      await page.goto("/plan");
      await expectMode(page, "fun");

      const palette = await openPaletteWithKeyboard(page);
      await palette.getByRole("combobox", { name: "Search" }).fill("feedback");
      await palette.getByRole("option", { name: "Send feedback" }).click();

      const form = page.getByRole("dialog", { name: "Feedback" });
      await expect(form).toBeVisible();
      await expect(form.getByRole("textbox", { name: "Message" })).toBeVisible();
    });
  });

  test("phones keep the top bar clear: no search button", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "exam" }, async ({ page }) => {
      await page.setViewportSize({ height: 812, width: 375 });
      await page.goto("/today");

      await expect(page.getByRole("button", { name: /Current goal/u })).toBeVisible();
      await expect(page.getByRole("button", { name: "Search" })).toBeHidden();
    });
  });
});
