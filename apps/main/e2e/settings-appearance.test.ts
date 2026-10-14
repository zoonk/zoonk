import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { milestoneFixture } from "@zoonk/testing/fixtures/memory";
import { type Page, expect, test } from "./fixtures";

/**
 * Preferences: the buddy can be chosen, changed, renamed and given earned glasses, sounds turn on
 * and off, a daily limit, and the app's language.
 */

function findProfile(userId: string) {
  return prisma.userLearningProfile.findUnique({ where: { userId } });
}

/** Preferences keeps its address from when it was called Appearance. */
async function openPreferences(page: Page) {
  await page.goto("/settings/appearance");
  await expect(page.getByRole("heading", { level: 1, name: "Preferences" })).toBeAttached();
}

test.describe("Preferences", () => {
  test("a learner starts with Zu and can choose a buddy, and Escape leaves settings for Today", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await goalFixture({ userId: noProgressUser.id });
    await planFixture({ goalId: goal.id });

    // On a phone, where the section's bar has the way back.
    await page.setViewportSize({ height: 812, width: 375 });
    await openPreferences(page);

    await expect(page.getByRole("button", { name: "Choose your buddy" })).toBeVisible();
    await expect(page.getByRole("main").getByText("Zu", { exact: true })).toBeVisible();

    await expect(
      page.getByRole("main").locator('[data-slot="buddy"][data-buddy="zu"]'),
    ).toHaveAttribute("data-energy", "awake");

    await expectAccessibleScreen(page, "the preferences");

    // Opened directly, the page's way back leads to the settings hub and the hub's to Today;
    // Escape presses each.
    await expect(
      page.getByRole("main").getByRole("link", { name: "Back to Settings" }),
    ).toHaveAttribute("href", "/settings");

    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/settings$/u);

    await expect(
      page.getByRole("main").getByRole("link", { exact: true, name: "Back" }),
    ).toHaveAttribute("href", "/today");

    await page.keyboard.press("Escape");

    await expect(page).toHaveURL(/\/today$/u);
    await expect(page.getByRole("navigation", { name: "Settings" })).toHaveCount(0);
  });

  test("changes and renames the buddy with only earned glasses", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await Promise.all([
      learningProfileFixture({ buddyKind: "zu", userId: noProgressUser.id }),
      milestoneFixture({ key: "star", kind: "glasses", userId: noProgressUser.id }),
    ]);

    await openPreferences(page);
    await page.getByRole("button", { name: "Change" }).click();

    const editor = page.getByRole("dialog", { name: "Your buddy" });
    await editor.getByRole("radio", { name: /^Otto/u }).click();
    await editor.getByRole("textbox", { name: "Name" }).fill("Octavia");

    await expect(editor.getByRole("radio", { name: /^Monocle/u })).toBeDisabled();
    await editor.getByRole("radio", { name: /^Star/u }).click();
    await editor.getByRole("button", { name: "Save" }).click();

    await expect(editor).toBeHidden();
    await expect(page.getByRole("main").getByText("Octavia", { exact: true })).toBeVisible();

    await expect
      .poll(() => findProfile(noProgressUser.id))
      .toMatchObject({ buddyGlasses: "star", buddyKind: "otto", buddyName: "Octavia" });
  });

  test("turns sounds off and on, and sets the learner's own daily time limit", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await openPreferences(page);

    const sounds = page.getByRole("switch", { name: "Sounds" });
    await expect(sounds).toBeChecked();

    await sounds.click();
    await expect(sounds).not.toBeChecked();

    await expect.poll(() => findProfile(noProgressUser.id)).toMatchObject({ soundsEnabled: false });

    await sounds.click();
    await expect(sounds).toBeChecked();
    await expect.poll(() => findProfile(noProgressUser.id)).toMatchObject({ soundsEnabled: true });

    const limit = page.getByRole("combobox", { name: "Daily time limit" });
    await expect(limit).toHaveValue("none");

    await limit.selectOption({ label: "30 min a day" });

    await expect
      .poll(() => findProfile(noProgressUser.id))
      .toMatchObject({ dailyLimitMinutes: 30 });

    await page.reload();
    await expect(page.getByRole("combobox", { name: "Daily time limit" })).toHaveValue("30");

    await page
      .getByRole("combobox", { name: "Daily time limit" })
      .selectOption({ label: "No limit" });

    await expect
      .poll(() => findProfile(noProgressUser.id))
      .toMatchObject({ dailyLimitMinutes: null });
  });

  test("a visitor gets the app's language and nothing to save", async ({ page }) => {
    await openPreferences(page);

    await expect(page.getByRole("combobox", { name: "App language" })).toHaveValue("en");
    await expect(page.getByRole("switch", { name: "Sounds" })).toHaveCount(0);
    await expect(page.getByText(/you need to be logged in/iu)).toHaveCount(0);
  });
});
