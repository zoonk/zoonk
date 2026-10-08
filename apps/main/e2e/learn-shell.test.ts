import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userProgressFixture } from "@zoonk/testing/fixtures/progress";
import { createGoalLearner } from "./checkpoint-fixtures";
import { openPaletteWithKeyboard } from "./command-palette";
import { expect, test } from "./fixtures";
import { asPersona, findPlanChapterId } from "./learn-personas";
import { createStudyDay, openAs } from "./study-day";

/** A chapter of Maya's plan, opened directly. */
const CHAPTER = "Exponents and scientific notation";

/** A learner with two planned goals, 40 and 15 minutes a day, on the first. */
async function createTwoGoalLearner() {
  const user = await createE2EUser(getBaseURL());

  const [first, second] = await Promise.all([
    goalFixture({ dailyMinutes: 40, title: "Bake sourdough bread", userId: user.id }),
    goalFixture({ dailyMinutes: 15, title: "Learn to cook", userId: user.id }),
  ]);

  await Promise.all([
    planFixture({ goalId: first.id }),
    planFixture({ goalId: second.id }),
    learningProfileFixture({ activeGoalId: first.id, userId: user.id }),
  ]);

  return { first, second, user };
}

async function readGoalStatus(goalId: string) {
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });
  return goal?.status;
}

async function readActiveGoalId(userId: string) {
  const profile = await prisma.userLearningProfile.findUnique({ where: { userId } });
  return profile?.activeGoalId;
}

/** The learning tabs' goal switcher: every tab reads the goal picked in it. */
test.describe("Learning tabs frame", () => {
  test("the goal switcher lists each goal's time a day, switches from the keyboard or the palette, and every tab follows", async ({
    browser,
  }) => {
    const { first, second, user } = await createTwoGoalLearner();
    const page = await openAs(browser, user);

    await page.goto("/today");

    const trigger = page.getByRole("button", { name: /Current goal: Bake sourdough bread/u });
    await trigger.click();

    await expect(page.getByText("Your goals")).toBeVisible();

    await expect(page.getByRole("menuitemradio", { name: "Bake sourdough bread" })).toContainText(
      "40 min a day",
    );

    await expect(page.getByRole("menuitemradio", { name: "Learn to cook" })).toContainText(
      "15 min a day",
    );

    await expect(page.getByRole("menuitem", { name: "Start a new goal" })).toHaveAttribute(
      "href",
      "/start",
    );

    await expect(page.getByRole("menuitem", { name: "Explore courses" })).toHaveAttribute(
      "href",
      "/courses",
    );

    // From the keyboard: Enter opens the menu on the current goal, the arrows move, Enter picks.
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Enter");
    // The menu is in the DOM a frame before it paints with the first goal focused; arrow keys
    // pressed in that gap still go to the trigger.
    await expect(page.getByRole("menuitemradio", { name: "Bake sourdough bread" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitemradio", { name: "Learn to cook" })).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("button", { name: /Current goal: Learn to cook/u })).toBeVisible();

    await expect.poll(() => readActiveGoalId(user.id)).toBe(second.id);

    // Before a buddy is picked, its tab is called Buddy.
    await page.getByRole("link", { exact: true, name: "Buddy" }).click();
    await expect(page).toHaveURL(/\/buddy$/u);

    await expect(page.getByRole("button", { name: /Current goal: Learn to cook/u })).toBeVisible();

    // The palette offers only the goals to switch to, not the one on screen.
    const palette = await openPaletteWithKeyboard(page);
    const goals = palette.getByRole("group", { name: "Goals" });

    await expect(goals.getByRole("option")).toHaveText(["Switch to Bake sourdough bread"]);

    await palette.getByRole("combobox", { name: "Search" }).fill("sourdough");
    await page.keyboard.press("Enter");

    await expect(palette).toBeHidden();

    await expect(
      page.getByRole("button", { name: /Current goal: Bake sourdough bread/u }),
    ).toBeVisible();

    await expect.poll(() => readActiveGoalId(user.id)).toBe(first.id);
    await page.context().close();
  });

  test("the switcher only switches; pausing, resuming and archiving live on the goal's Journey, archiving after a confirmation", async ({
    browser,
  }) => {
    const { first, second, user } = await createTwoGoalLearner();
    const page = await openAs(browser, user);

    await page.goto("/today");

    // The switcher lists the goals and leads to a new one, without acting on any of them.
    const trigger = page.getByRole("button", { name: /Current goal: Bake sourdough bread/u });
    await trigger.click();
    await expect(page.getByRole("menuitemradio")).toHaveCount(2);
    await expect(page.getByRole("menuitem", { name: /this goal$/u })).toHaveCount(0);
    await page.keyboard.press("Escape");

    // On the goal's own page it's clear which goal changes.
    await page.goto("/journey");
    const openMenu = () => page.getByRole("button", { name: "Journey options" }).click();

    await openMenu();
    await page.getByRole("menuitem", { name: "Pause this goal" }).click();

    await expect.poll(() => readGoalStatus(first.id)).toBe("paused");

    // Paused, the Journey says so, with the way back right there.
    const notice = page.getByText("This goal is on pause. Nothing is planned until you resume it.");
    await expect(notice).toBeVisible();

    await trigger.click();

    await expect(page.getByRole("menuitemradio", { name: "Bake sourdough bread" })).toContainText(
      "Paused",
    );

    await page.keyboard.press("Escape");

    // The free plan follows one goal at a time, and the other one is active: resuming says so.
    await page.getByRole("main").getByRole("button", { exact: true, name: "Resume" }).click();

    await expect(page.getByRole("region", { name: "Notifications" })).toContainText(
      "The free plan follows one goal at a time. Pause your other goal to resume this one, or get Plus for more.",
    );

    await expect.poll(() => readGoalStatus(first.id)).toBe("paused");

    // Archiving asks first; cancelling keeps the goal.
    await openMenu();
    await expect(page.getByRole("menuitem", { name: "Resume this goal" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Archive this goal" }).click();

    const confirm = page.getByRole("alertdialog", { name: "Archive Bake sourdough bread?" });
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).toBeHidden();
    await expect.poll(() => readGoalStatus(first.id)).toBe("paused");

    await openMenu();
    await page.getByRole("menuitem", { name: "Archive this goal" }).click();
    await confirm.getByRole("button", { name: "Archive" }).click();

    // The archived goal leaves its Journey for Today, which moves to the goal still active.
    await expect(page).toHaveURL(/\/today$/u);
    await expect(page.getByRole("button", { name: /Current goal: Learn to cook/u })).toBeVisible();
    await expect.poll(() => readActiveGoalId(user.id)).toBe(second.id);
    await expect.poll(() => readGoalStatus(first.id)).toBe("archived");

    await page.getByRole("button", { name: /Current goal: Learn to cook/u }).click();
    await expect(page.getByRole("menuitemradio")).toHaveCount(1);
    await page.context().close();
  });

  test("a long goal title stays whole on hover and in the menu on a phone", async ({ browser }) => {
    const { goal, user } = await createGoalLearner();
    const title = "Understand quantum physics well enough to explain it to my grandmother";

    await Promise.all([
      prisma.goal.update({ data: { title }, where: { id: goal.id } }),
      planFixture({ goalId: goal.id }),
    ]);

    const page = await openAs(browser, user);
    await page.setViewportSize({ height: 812, width: 375 });

    await page.goto("/today");

    const trigger = page.getByRole("button", { name: `Current goal: ${title}. Switch goal` });
    await expect(trigger).toHaveAttribute("title", title);

    await trigger.click();
    await expect(page.getByRole("menuitemradio", { name: title })).toBeVisible();
    await page.context().close();
  });

  test("visitors without a goal are invited to start one", async ({ page }) => {
    await page.goto("/buddy");

    await expect(page.getByRole("heading", { name: "Start with a goal" })).toBeVisible();

    await expect(
      page.getByRole("main").getByRole("link", { name: "Start a goal" }),
    ).toHaveAttribute("href", "/start");
  });
});

/**
 * Three places, always in the same spot: at the top from `lg` (laptops and tablets held sideways),
 * at the bottom under it (phones and tablets held upright), where the thumb is.
 */
test.describe("Learning tabs", () => {
  test("on a laptop, Today, Journey and the buddy sit in the middle of the top bar, and the keyboard moves through them", async ({
    browser,
  }) => {
    const { user } = await createStudyDay({ buddy: true });
    await userProgressFixture({ currentEnergy: 80, totalBrainPower: 1200n, userId: user.id });

    const page = await openAs(browser, user);
    await page.setViewportSize({ height: 860, width: 1280 });
    await page.goto("/today");

    const bar = page.getByRole("banner");
    const tabs = bar.getByRole("navigation", { name: "Learning tabs" });

    await expect(tabs.getByRole("link")).toHaveText(["Today", "Journey", /^Zu/u]);

    await expect(tabs.getByRole("link", { exact: true, name: "Today" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await expect(tabs.getByRole("link", { name: "Journey" })).toHaveAttribute("href", "/journey");
    await expect(tabs.getByRole("link", { name: /^Zu/u })).toHaveAttribute("href", "/buddy");

    // The goal on the left; the learner's belt and level (opening Statistics) and the account on
    // the right. Energy lives on the buddy's page, and nothing else waits at the bottom.
    const level = bar.getByRole("link", { name: /^\w+ belt, level \d+\. Statistics$/u });

    await expect(bar.getByRole("button", { name: /Current goal: E2E exam/u })).toBeVisible();
    await expect(level).toHaveAttribute("href", "/stats");
    await expect(bar.getByRole("button", { name: "User menu" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Energy/u })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Learning tabs" })).toHaveCount(1);

    // Tab order is reading order: the goal, the three tabs, the level, the account. Enter opens a
    // tab.
    await bar.getByRole("button", { name: /Current goal/u }).focus();
    await page.keyboard.press("Tab");
    await expect(tabs.getByRole("link", { exact: true, name: "Today" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(tabs.getByRole("link", { name: "Journey" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(tabs.getByRole("link", { name: /^Zu/u })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(level).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(bar.getByRole("button", { name: "User menu" })).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/buddy$/u);
    await expect(tabs.getByRole("link", { name: /^Zu/u })).toHaveAttribute("aria-current", "page");
    await page.context().close();
  });

  test("on a phone, the tabs are a bar at the bottom, in thumb reach, that never covers the page", async ({
    browser,
  }) => {
    const { user } = await createStudyDay({ buddy: true });
    const page = await openAs(browser, user);
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto("/today");

    const bar = page.getByRole("banner");
    const tabs = page.getByRole("navigation", { name: "Learning tabs" });

    // The top bar keeps the goal and the account; the tabs are at the bottom of the screen.
    await expect(bar.getByRole("button", { name: /Current goal: E2E exam/u })).toBeVisible();
    await expect(bar.getByRole("button", { name: "User menu" })).toBeVisible();
    await expect(bar.getByRole("navigation")).toHaveCount(0);
    await expect(tabs.getByRole("link")).toHaveText(["Today", "Journey", /^Zu/u]);

    const barBox = await tabs.boundingBox();
    expect(barBox!.y + barBox!.height).toBeCloseTo(844, 0);

    const links = await tabs.getByRole("link").all();
    const targets = await Promise.all(links.map((link) => link.boundingBox()));

    for (const target of targets) {
      expect(target!.height).toBeGreaterThanOrEqual(44);
      expect(target!.width).toBeGreaterThanOrEqual(44);
    }

    // The bar only exists on narrow screens, so it gets its own scan here.
    await expectAccessibleScreen(page, "the tab bar on a phone");

    // At the end of the page, the last of it sits above the bar instead of under it.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const [mainBox, endBox] = await Promise.all([
      page.getByRole("main").boundingBox(),
      tabs.boundingBox(),
    ]);

    expect(mainBox!.y + mainBox!.height).toBeLessThanOrEqual(endBox!.y + 1);

    await tabs.getByRole("link", { name: /^Zu/u }).click();
    await expect(page).toHaveURL(/\/buddy$/u);
    await expect(tabs.getByRole("link", { name: /^Zu/u })).toHaveAttribute("aria-current", "page");

    // The whole current tab is selected (its label too, on one pill), not only its icon.
    const background = (name: string) =>
      tabs
        .getByRole("link", { name: new RegExp(`^${name}`, "u") })
        .evaluate((link) => getComputedStyle(link).backgroundColor);

    await page.mouse.move(0, 0);
    await expect.poll(() => background("Zu")).not.toBe("rgba(0, 0, 0, 0)");
    await expect.poll(() => background("Today")).toBe("rgba(0, 0, 0, 0)");

    // Adding a goal is a step of its own, without the tabs.
    await page.goto("/start");
    await expect(page.getByRole("textbox", { name: "Your goal" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Learning tabs" })).toHaveCount(0);
    await page.context().close();
  });
});

/**
 * A page opened from a tab (a chapter, a subject, the exam, the mistakes notebook) puts its own bar
 * in the app bar's place: the way back on the left, its actions on the right, and the tabs where
 * they always are.
 */
test.describe("Pages opened from a tab", () => {
  test("on a phone, the page's bar replaces the app bar, the tab bar stays, and Escape goes back to where the page was opened", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page }) => {
      await page.setViewportSize({ height: 844, width: 390 });
      await page.goto("/today");

      await page.getByRole("link", { name: /^Mistakes notebook/u }).click();
      await expect(page).toHaveURL(/\/mistakes$/u);
      await expect(page.getByRole("heading", { level: 1, name: "3 to fix" })).toBeVisible();

      // Nothing from the app bar: the goal and the account belong to the tabs' own pages.
      await expect(page.getByRole("button", { name: /Current goal/u })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "User menu" })).toHaveCount(0);

      const back = page.getByRole("link", { name: "Back to Today" });
      await expect(back).toHaveAttribute("href", "/today");

      const tabs = page.getByRole("navigation", { name: "Learning tabs" });

      await expect(tabs.getByRole("link", { exact: true, name: "Today" })).toHaveAttribute(
        "aria-current",
        "page",
      );

      await page.keyboard.press("Escape");
      await expect(page).toHaveURL(/\/today$/u);
      await expect(page.getByRole("button", { name: /Current goal/u })).toBeVisible();
    });
  });

  test("on a laptop, the page's bar keeps the tabs in its middle and its actions on the right", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "hugeGoal" }, async ({ page, user }) => {
      const chapterId = await findPlanChapterId(user.goalId, CHAPTER);

      await page.setViewportSize({ height: 860, width: 1280 });
      await page.goto(`/content/chapters/${chapterId}`);
      await expect(page.getByRole("heading", { level: 1, name: CHAPTER })).toBeVisible();

      await expect(page.getByRole("button", { name: /Current goal/u })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Back to Journey" })).toBeVisible();

      await expect(
        page.getByRole("button", { name: "Ask Buddy about this chapter" }),
      ).toBeVisible();

      await expect(page.getByRole("button", { name: "Chapter options" })).toBeVisible();

      const tabs = page.getByRole("navigation", { name: "Learning tabs" });
      await expect(tabs).toHaveCount(1);

      await expect(tabs.getByRole("link", { name: "Journey" })).toHaveAttribute(
        "aria-current",
        "page",
      );

      // Opened directly, there's no page to return to: the way back leads to the Journey.
      await page.getByRole("link", { name: "Back to Journey" }).click();
      await expect(page).toHaveURL(/\/journey$/u);
    });
  });
});
