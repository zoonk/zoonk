import { EXPERIENCE_MODE_COOKIE } from "@zoonk/core/profile/mode-cookie";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { milestoneFixture } from "@zoonk/testing/fixtures/memory";
import { type Page, expect, test } from "./fixtures";

/**
 * Appearance: Focus or Fun switches instantly and changes no learning data, the Fun buddy can be
 * changed, renamed and given earned glasses, and sounds turn on and off.
 */

/** Deep space, Fun's canvas (`--fun-canvas` in `@zoonk/ui/fun.css`). */
const DEEP_SPACE = "rgb(12, 10, 34)";
const WHITE = "rgb(255, 255, 255)";

function findProfile(userId: string) {
  return prisma.userLearningProfile.findUnique({ where: { userId } });
}

/** A goal with its plan, to prove switching modes leaves the learning alone. */
async function createPlan(userId: string) {
  const goal = await goalFixture({ userId });
  const plan = await planFixture({ goalId: goal.id });

  return { goal, plan };
}

async function openAppearance(page: Page) {
  await page.goto("/settings/appearance");
  await expect(page.getByRole("heading", { level: 1, name: "Appearance" })).toBeVisible();
}

test.describe("Appearance", () => {
  test("switching from Focus to Fun is instant and changes no learning data", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const { goal, plan } = await createPlan(noProgressUser.id);
    await openAppearance(page);

    await expect(page.getByRole("radio", { name: /^Focus/u })).toBeChecked();
    await expect(page.getByText("Your buddy")).toBeHidden();
    await expectAccessibleScreen(page, "the appearance settings");

    // The scan leaves the device light: the Fun choice previews deep space while Focus stays light.
    await expect(page.getByRole("radiogroup").locator('[data-mode="fun"]')).toHaveCSS(
      "background-color",
      DEEP_SPACE,
    );

    await expect(page.locator('[data-slot="mode-root"] [data-slot="learn-shell"]')).toHaveCSS(
      "background-color",
      WHITE,
    );

    await page.getByRole("radio", { name: /^Fun/u }).click();

    await expect(page.getByRole("radio", { name: /^Fun/u })).toBeChecked();
    await expect(page.getByRole("button", { name: "Choose your buddy" })).toBeVisible();

    await expect(
      page
        .getByRole("navigation", { name: "Settings" })
        .getByRole("link", { exact: true, name: "Home page" }),
    ).toBeVisible();

    await expect(page.getByRole("link", { exact: true, name: "Route" })).toHaveCount(0);

    await expect
      .poll(() => findProfile(noProgressUser.id))
      .toMatchObject({ experienceMode: "fun" });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      updatedAt: plan.updatedAt,
      version: plan.version,
    });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      status: goal.status,
      updatedAt: goal.updatedAt,
    });

    await page.getByRole("link", { exact: true, name: "Home page" }).click();
    await expect(page).toHaveURL(/\/today$/u);
    await expect(page.getByRole("link", { exact: true, name: "Route" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Settings" })).toHaveCount(0);
  });

  test("changes and renames the buddy with only earned glasses, and keeps it when back in Focus", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await Promise.all([
      learningProfileFixture({ buddyKind: "zu", experienceMode: "fun", userId: noProgressUser.id }),
      milestoneFixture({ key: "star", kind: "glasses", userId: noProgressUser.id }),
    ]);

    await openAppearance(page);
    await expectAccessibleScreen(page, "the Fun appearance settings");
    await page.getByRole("button", { name: "Change" }).click();

    const editor = page.getByRole("dialog", { name: "Your buddy" });
    await editor.getByRole("radio", { name: /^Otto/u }).click();
    await editor.getByRole("textbox", { name: "Name" }).fill("Octavia");

    await expect(editor.getByRole("radio", { name: /^Monocle/u })).toBeDisabled();
    await editor.getByRole("radio", { name: /^Star/u }).click();
    await editor.getByRole("button", { name: "Save" }).click();

    await expect(editor).toBeHidden();

    const buddyName = page.getByRole("main").getByText("Octavia", { exact: true });
    await expect(buddyName).toBeVisible();

    await expect
      .poll(() => findProfile(noProgressUser.id))
      .toMatchObject({ buddyGlasses: "star", buddyKind: "otto", buddyName: "Octavia" });

    await page.getByRole("radio", { name: /^Focus/u }).click();
    await expect(buddyName).toBeHidden();

    await expect
      .poll(() => findProfile(noProgressUser.id))
      .toMatchObject({
        buddyGlasses: "star",
        buddyKind: "otto",
        buddyName: "Octavia",
        experienceMode: "focus",
      });
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

  test("a visitor switches mode on the device only", async ({ page }) => {
    await openAppearance(page);

    await expect(page.getByRole("switch", { name: "Sounds" })).toBeHidden();
    await page.getByRole("radio", { name: /^Fun/u }).click();
    await expect(page.getByRole("radio", { name: /^Fun/u })).toBeChecked();

    await expect
      .poll(() => page.context().cookies())
      .toContainEqual(expect.objectContaining({ name: EXPERIENCE_MODE_COOKIE, value: "fun" }));

    await page.reload();
    await expect(page.getByRole("radio", { name: /^Fun/u })).toBeChecked();
  });
});
