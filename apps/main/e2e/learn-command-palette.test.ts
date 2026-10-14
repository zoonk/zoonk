import { catalogCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import { openPaletteWithKeyboard } from "./command-palette";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { createStudyDay, openAs } from "./study-day";

/** A chapter of Maya's plan. */
const CHAPTER = "Exponents and scientific notation";

/**
 * The learning tabs' command palette: the same Cmd/Ctrl+K palette as the catalog, with what the
 * learner can do and their places instead of the catalog's pages. The sidebar's search field opens
 * it on a laptop, and the one under the top bar on a phone.
 */
test.describe("Learning tabs command palette", () => {
  test("opens on the learner's actions and places only, and goes to one from the keyboard", async ({
    browser,
  }) => {
    const { user } = await createStudyDay({ buddy: true });
    const page = await openAs(browser, user);

    await page.goto("/today");

    // Cmd/Ctrl+K opens the palette anywhere; on a laptop the sidebar's field opens the same one.
    await expect(
      page
        .getByRole("complementary", { name: "Sidebar" })
        .getByRole("button", { name: "Search or ask…" }),
    ).toBeVisible();

    const palette = await openPaletteWithKeyboard(page);

    // What the learner can do comes first: go on with the day (its next block's minutes at the
    // end), an exam goal's mock exam, and asking the buddy.
    const actions = palette.getByRole("group", { name: "Actions" });

    await expect(actions.getByRole("option")).toHaveText([
      /^Continue today's session/u,
      /^Take a mock exam/u,
      "Ask Zu…",
    ]);

    await expect(actions.getByRole("option", { name: /^Continue today's session/u })).toContainText(
      "2 min",
    );

    // Then the places, as the sidebar lists them: no mind maps before there are some, and the
    // account, help and the catalog only for a query.
    const pages = palette.getByRole("group", { name: "Go to" });

    await expect(pages.getByRole("option")).toHaveText([
      "Today",
      "Plan",
      "Zu",
      "Mistakes notebook",
      "Exam",
      "Logbook",
      "Statistics",
    ]);

    await expect(palette.getByRole("group", { name: "My account" })).toHaveCount(0);

    await palette.getByRole("combobox", { name: "Search" }).fill("buddy");
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/buddy$/u);
    await expect(palette).toBeHidden();

    await expect(
      page.getByRole("navigation", { name: "Learning tabs" }).getByRole("link", { name: "Zu" }),
    ).toHaveAttribute("aria-current", "page");

    await page.context().close();
  });

  test("asks the buddy what the learner typed: it waits in the composer until they send it", async ({
    browser,
  }) => {
    const { user } = await createStudyDay({ buddy: true });
    const page = await openAs(browser, user);
    const question = "Why do two discounts in a row not add up?";

    await page.goto("/today");

    const palette = await openPaletteWithKeyboard(page);
    await palette.getByRole("combobox", { name: "Search" }).fill(question);

    // Whatever the learner types ends with asking the buddy, then starting a goal: no dead end.
    const ask = palette.getByRole("group", { name: "Ask" });

    await expect(ask.getByRole("option")).toHaveText([
      /^Ask Zu: “Why do two discounts in a row not add up\?”/u,
      "Start a new goal: “Why do two discounts in a row not add up?”",
    ]);

    await ask.getByRole("option", { name: /^Ask Zu/u }).click();

    await expect(page).toHaveURL(/\/buddy\?ask=/u);
    await expect(palette).toBeHidden();

    const conversation = page.getByRole("region", { name: "Conversation with Zu" });

    await expect(conversation.getByRole("textbox", { name: "Message Zu" })).toHaveValue(question);

    // Only the learner's own send asks it.
    await expect(conversation.getByRole("log")).not.toContainText(question);

    await page.context().close();
  });

  test("finds the learner's own chapters before the catalog's", async ({ browser }) => {
    await asPersona(browser, { persona: "hugeGoal" }, async ({ page }) => {
      await page.goto("/today");

      const palette = await openPaletteWithKeyboard(page);
      await palette.getByRole("combobox", { name: "Search" }).fill("Exponents");

      const plan = palette.getByRole("group", { name: "Your plan" });
      await plan.getByRole("option", { name: new RegExp(`^${CHAPTER}`, "u") }).click();

      await expect(page).toHaveURL(/\/content\/chapters\//u);
      await expect(page.getByRole("heading", { level: 1, name: CHAPTER })).toBeVisible();
    });
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
      "/plan",
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
        palette.getByRole("group", { name: "Go to" }).getByRole("option").first(),
      ).toHaveText("Today");

      // oxlint-disable-next-line no-await-in-loop -- Closes it before the next screen.
      await page.keyboard.press("Escape");
      // oxlint-disable-next-line no-await-in-loop -- Closed before leaving the screen.
      await expect(palette).toBeHidden();
    }

    await page.context().close();
  });
});
