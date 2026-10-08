import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import {
  guardianLinkFixture,
  learningProfileFixture,
} from "@zoonk/testing/fixtures/learning-profiles";
import { milestoneFixture } from "@zoonk/testing/fixtures/memory";
import { type Page, expect, test } from "./fixtures";

/**
 * Appearance: the buddy can be chosen, changed, renamed and given earned glasses, sounds turn on
 * and off, a daily limit (under a guardian's, when one set it), and the app's language.
 */

const TEEN_BIRTH_YEAR = new Date().getUTCFullYear() - 15;

function findProfile(userId: string) {
  return prisma.userLearningProfile.findUnique({ where: { userId } });
}

async function openAppearance(page: Page) {
  await page.goto("/settings/appearance");
  await expect(page.getByRole("heading", { level: 1, name: "Appearance" })).toBeVisible();
}

test.describe("Appearance", () => {
  test("a learner without a buddy is offered one, and Escape leaves settings for Today", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await goalFixture({ userId: noProgressUser.id });
    await planFixture({ goalId: goal.id });
    await openAppearance(page);

    await expect(page.getByRole("button", { name: "Choose your buddy" })).toBeVisible();
    await expectAccessibleScreen(page, "the appearance settings");

    // Opened directly, the page's way back leads to the settings hub and the hub's to Today;
    // Escape presses each.
    await expect(
      page.getByRole("banner").getByRole("link", { name: "Back to Settings" }),
    ).toHaveAttribute("href", "/settings");

    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/settings$/u);

    await expect(
      page.getByRole("banner").getByRole("link", { exact: true, name: "Back" }),
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

    await openAppearance(page);
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
    await openAppearance(page);

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

  test("a teen sees their guardian's daily limit and can only pick a shorter one", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await Promise.all([
      learningProfileFixture({
        birthMonth: 1,
        birthYear: TEEN_BIRTH_YEAR,
        userId: noProgressUser.id,
      }),
      guardianLinkFixture({
        acceptedAt: new Date(),
        dailyLimitMinutes: 60,
        status: "active",
        userId: noProgressUser.id,
      }),
    ]);

    await openAppearance(page);

    const limit = page.getByRole("combobox", { name: "Daily time limit" });

    await expect(limit.locator("option:checked")).toHaveText("60 min a day");

    await expect(
      page.getByText("Your guardian set this limit. You can choose a shorter one."),
    ).toBeVisible();

    await expect(limit.locator("option")).toHaveText([
      "60 min a day",
      "15 min a day",
      "30 min a day",
      "45 min a day",
    ]);

    await limit.selectOption({ label: "30 min a day" });

    await expect
      .poll(() => findProfile(noProgressUser.id))
      .toMatchObject({ dailyLimitMinutes: 30 });
  });

  test("a visitor gets the app's language and nothing to save", async ({ page }) => {
    await openAppearance(page);

    await expect(page.getByRole("combobox", { name: "App language" })).toHaveValue("en");
    await expect(page.getByRole("switch", { name: "Sounds" })).toHaveCount(0);
    await expect(page.getByText(/you need to be logged in/iu)).toHaveCount(0);
  });
});
