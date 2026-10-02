import { userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { type Page, expect, test } from "./fixtures";
import { type Mode, expectMode } from "./learn-personas";
import { createStudyDay, openAs } from "./study-day";

/** A learner of today's study day with Brain Power and Energy, which the top bar shows. */
async function createLearner(mode: Mode) {
  const { user } = await createStudyDay({ mode });
  await userProgressFixture({ currentEnergy: 80, totalBrainPower: 1200n, userId: user.id });
  return user;
}

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
 * The learning tabs' command palette and frame: the same Cmd/Ctrl+K palette as the catalog, with
 * the learner's places in their mode's names, around the goal switcher, the Focus tabs or the Fun
 * dock, Energy and the account menu.
 */
test.describe("Learning tabs command palette", () => {
  test("Focus lists the tabs by name, goes to one from the keyboard and frames it, without search on phones", async ({
    browser,
  }) => {
    const page = await openAs(browser, await createLearner("focus"));

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

    // Focus frames the tabs with the goal, the four tabs and Energy.
    const tabs = page
      .getByRole("navigation")
      .filter({ has: page.getByRole("link", { name: "Content" }) });

    await expect(page.getByRole("button", { name: /Current goal: E2E exam/u })).toBeVisible();
    await expect(tabs.getByRole("link")).toHaveText(["Today", "Plan", "Progress", "Content"]);
    await expect(tabs.getByRole("link", { name: "Plan" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: /Energy/u })).toHaveAttribute("href", "/energy");
    await expect(page.getByRole("link", { name: /Brain Power/u })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "User menu" })).toBeVisible();

    // Phones keep the top bar clear: no search button.
    await page.setViewportSize({ height: 812, width: 375 });
    await page.goto("/today");

    await expect(page.getByRole("button", { name: /Current goal/u })).toBeVisible();
    await expect(page.getByRole("button", { name: "Search" })).toBeHidden();
    await page.context().close();
  });

  test("Fun names the places as its dock does, with the buddy, the logbook and Brain Power", async ({
    browser,
  }) => {
    const page = await openAs(browser, await createLearner("fun"));

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

    // Fun's labeled dock, with the buddy, the level and Brain Power.
    const dock = page
      .getByRole("navigation")
      .filter({ has: page.getByRole("link", { name: "Route" }) });

    await expect(dock.getByRole("link")).toHaveText(["Today", "Route", "Cards", "Zu"]);
    await expect(dock.getByRole("link", { name: "Cards" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: /Brain Power/u })).toBeVisible();
    await expect(page.getByRole("link", { name: /Energy/u })).toBeVisible();
    await page.context().close();
  });
});
