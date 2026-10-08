import { catalogCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import { openPaletteWithKeyboard } from "./command-palette";
import { expect, test } from "./fixtures";
import { createStudyDay, openAs } from "./study-day";

/**
 * The learning tabs' command palette: the same Cmd/Ctrl+K palette as the catalog, with the
 * learner's places instead of the catalog's pages. The top bar has no search button.
 */
test.describe("Learning tabs command palette", () => {
  test("lists the learner's places in the tabs' order and goes to one from the keyboard", async ({
    browser,
  }) => {
    const { user } = await createStudyDay({ buddy: true });
    const page = await openAs(browser, user);

    await page.goto("/today");

    // Cmd/Ctrl+K opens the palette; the bar keeps no search button at any width.
    await expect(page.getByRole("button", { name: "Search" })).toHaveCount(0);

    const palette = await openPaletteWithKeyboard(page);
    const pages = palette.getByRole("group", { name: "Pages" });

    await expect(pages.getByRole("option")).toHaveText([
      "Today",
      "Journey",
      "Your buddy",
      "Mistakes notebook",
      "Statistics",
      "Explore courses",
      "Start a new goal",
    ]);

    await palette.getByRole("combobox", { name: "Search" }).fill("buddy");
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/buddy$/u);
    await expect(palette).toBeHidden();

    await expect(
      page.getByRole("navigation", { name: "Learning tabs" }).getByRole("link", { name: "Zu" }),
    ).toHaveAttribute("aria-current", "page");

    await page.context().close();
  });

  test("Cmd/Ctrl+K opens the same palette from every screen of the app, tasks included", async ({
    browser,
  }) => {
    const [{ lesson, user }, { course, organization }] = await Promise.all([
      createStudyDay({ buddy: true }),
      catalogCourseFixture(),
    ]);

    const page = await openAs(browser, user);

    const screens = [
      "/today",
      "/journey",
      "/buddy",
      "/settings/appearance",
      "/support",
      "/courses",
      `/b/${organization.slug}/c/${course.slug}`,
      `/learn/${lesson.id}`,
      "/session",
    ];

    for (const screen of screens) {
      // oxlint-disable-next-line no-await-in-loop -- One screen after the other, in one tab.
      await page.goto(screen);

      // oxlint-disable-next-line no-await-in-loop -- The palette opens on this screen.
      const palette = await openPaletteWithKeyboard(page);

      // The learner's own places, wherever they are.
      // oxlint-disable-next-line no-await-in-loop -- Checked before the palette closes.
      await expect(
        palette.getByRole("group", { name: "Pages" }).getByRole("option").first(),
      ).toHaveText("Today");

      // oxlint-disable-next-line no-await-in-loop -- Closes it before the next screen.
      await page.keyboard.press("Escape");
      // oxlint-disable-next-line no-await-in-loop -- Closed before leaving the screen.
      await expect(palette).toBeHidden();
    }

    await page.context().close();
  });
});
