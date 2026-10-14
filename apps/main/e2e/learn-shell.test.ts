import { type Page } from "@playwright/test";
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

async function readPhoneTitleTop(tab: Page) {
  await tab.setViewportSize({ height: 844, width: 390 });
  await tab.goto("/today");

  await expect(tab.getByRole("banner")).toBeVisible();
  await expect(tab.locator('[data-slot="today-skeleton"]')).toHaveCount(0);

  const title = tab.getByRole("main").getByRole("heading", { level: 1, name: "Today" });
  await expect(title).toBeVisible();

  const box = await title.boundingBox();
  return box?.y;
}

/**
 * A task link that leads nowhere says so inside the task's frame, as its loading screen drew it
 * (the ✕ to leave), instead of the public site's header and footer.
 */
async function expectTaskNotFound(tab: Page, path: string) {
  await tab.goto(path);

  await expect(tab.getByRole("heading", { name: "We couldn't find this page" })).toBeVisible();
  await expect(tab.getByRole("contentinfo")).toHaveCount(0);
  await expect(tab.getByRole("link", { name: "Leave" })).toBeVisible();
}

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

    // Before a buddy is picked, its tab shows the default buddy, Zu.
    await page.getByRole("link", { exact: true, name: "Zu" }).click();
    await expect(page).toHaveURL(/\/buddy$/u);

    await expect(page.getByRole("button", { name: /Current goal: Learn to cook/u })).toBeVisible();

    // The palette offers only the goals to switch to, not the one on screen.
    const palette = await openPaletteWithKeyboard(page);
    const goals = palette.getByRole("group", { name: "Your goals" });

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
    await page.goto("/plan");
    const openMenu = () => page.getByRole("button", { name: "Plan options" }).click();

    await openMenu();
    await page.getByRole("menuitem", { name: "Pause this goal" }).click();

    await expect.poll(() => readGoalStatus(first.id)).toBe("paused");

    // Paused, the Plan's one suggestion says so, with the way back right there.
    const notice = page.getByRole("region", { name: "Bake sourdough bread is paused" });
    await expect(notice).toContainText("Nothing is planned until you resume it.");

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

    // The archived goal leaves its Plan for Today, which moves to the goal still active.
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

  test("a learner whose only goal is a quick explanation finds it in the goal menu", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());
    const title = "What does “the market is up 2%” mean?";
    const goal = await goalFixture({ kind: "explain", title, userId: user.id });
    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

    const page = await openAs(browser, user);
    await page.goto("/today");

    await page
      .getByRole("complementary", { name: "Sidebar" })
      .getByRole("button", { name: "Start a goal" })
      .click();

    await expect(page.getByText("Quick explanations")).toBeVisible();

    await expect(page.getByRole("menuitem", { name: title })).toHaveAttribute(
      "href",
      `/explain/${goal.id}`,
    );

    await expect(page.getByRole("menuitem", { name: "Start a new goal" })).toHaveAttribute(
      "href",
      "/start",
    );

    await page.context().close();
  });

  test("visitors keep each page's title and what it is, with the way in right under it", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 860, width: 1280 });
    await page.goto("/today");

    const main = page.getByRole("main");
    const todayHeading = main.getByRole("heading", { level: 1, name: "Today" });

    // Measured once painted: a title not in sight yet has no box.
    await expect(todayHeading).toBeVisible();
    const todayTitle = await todayHeading.boundingBox();

    const gatedPages = [
      {
        description: "What you'll study each day until your goal, and what it covers.",
        path: "/plan",
        title: "Plan",
      },
      {
        description: "Your buddy answers your questions and adjusts your plan.",
        path: "/buddy",
        title: "Your buddy",
      },
      {
        description: "The questions you got wrong, why, and practice until you get them right.",
        path: "/mistakes",
        title: "Mistakes notebook",
      },
    ];

    for (const { description, path, title } of gatedPages) {
      // oxlint-disable-next-line no-await-in-loop -- One page after the other, in one tab.
      await page.goto(path);

      // A visitor may have goals in an account: the page keeps its title and says what it is,
      // then they log in and come back here, or start free.
      const heading = main.getByRole("heading", { level: 1, name: title });

      // oxlint-disable-next-line no-await-in-loop -- Checks this page before the next one.
      await expect(heading).toBeVisible();
      // oxlint-disable-next-line no-await-in-loop -- Checks this page before the next one.
      await expect(main.getByText(description)).toBeVisible();

      // oxlint-disable-next-line no-await-in-loop -- Checks this page before the next one.
      await expect(
        main.getByRole("heading", { level: 2, name: "Log in to continue" }),
      ).toBeVisible();

      // oxlint-disable-next-line no-await-in-loop -- Checks this page before the next one.
      await expect(main.getByRole("link", { name: "Log in" })).toHaveAttribute(
        "href",
        `/login?next=${encodeURIComponent(path)}`,
      );

      // oxlint-disable-next-line no-await-in-loop -- Checks this page before the next one.
      await expect(main.getByRole("link", { name: "Start free" })).toHaveAttribute(
        "href",
        "/start",
      );
    }

    // Moving from Today to the Plan keeps the large title in its place.
    await page.goto("/plan");
    const planHeading = main.getByRole("heading", { level: 1, name: "Plan" });

    await expect(planHeading).toBeVisible();
    const planTitle = await planHeading.boundingBox();

    expect(planTitle?.y).toBe(todayTitle?.y);
  });

  // A tab's own page draws the top bar from its first paint, and a page with its own bar (the
  // notebook's) never shows it: either way the title stays where it first painted.
  for (const path of ["/today", "/mistakes"]) {
    test(`on a phone, ${path}'s title never moves while the page loads`, async ({ page }) => {
      // Where the title is on every frame from the first one it's in, as the page streams in.
      await page.addInitScript(() => {
        const tops: number[] = [];
        Object.defineProperty(globalThis, "zoonkTitleTops", { value: tops });

        const record = () => {
          const title = document.querySelector("main h1");

          if (title) {
            tops.push(Math.round(title.getBoundingClientRect().top));
          }

          if (document.readyState !== "complete" || tops.length < 10) {
            requestAnimationFrame(record);
          }
        };

        requestAnimationFrame(record);
      });

      await page.setViewportSize({ height: 844, width: 390 });
      await page.goto(path);
      await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();

      const tops = await page.evaluate(
        () => (globalThis as unknown as { zoonkTitleTops: number[] }).zoonkTitleTops,
      );

      expect(tops.length).toBeGreaterThan(0);
      expect(new Set(tops)).toStrictEqual(new Set([tops[0]]));
    });
  }

  test("on a phone, a visitor's title sits where a learner's does: the top bar keeps one height", async ({
    browser,
    page,
  }) => {
    const { user } = await createStudyDay();
    const learnerPage = await openAs(browser, user);

    // The learner's goal and level are 36px and a visitor's "Log in" 44px; the bar's row is 44px.
    const learnerTop = await readPhoneTitleTop(learnerPage);
    const visitorTop = await readPhoneTitleTop(page);

    expect(visitorTop).toBeDefined();
    expect(visitorTop).toBe(learnerTop);

    await learnerPage.context().close();
  });
});

/**
 * Three places, always in the same spot: at the top from `lg` (laptops and tablets held sideways),
 * at the bottom under it (phones and tablets held upright), where the thumb is.
 */
test.describe("Learning tabs", () => {
  test("on a laptop, the sidebar holds the goal, search, Today, the Plan and the buddy, the study shortcuts and the account, in keyboard order", async ({
    browser,
  }) => {
    const { user } = await createStudyDay({ buddy: true });
    await userProgressFixture({ currentEnergy: 80, totalBrainPower: 1200n, userId: user.id });

    const page = await openAs(browser, user);
    await page.setViewportSize({ height: 860, width: 1280 });
    await page.goto("/today");

    const sidebar = page.getByRole("complementary", { name: "Sidebar" });
    const tabs = sidebar.getByRole("navigation", { name: "Learning tabs" });
    const study = sidebar.getByRole("navigation", { name: "Study" });

    await expect(tabs.getByRole("link")).toHaveText([/^Today/u, "Plan", /^Zu/u]);

    // Today ends with what's left of the day's session.
    const today = tabs.getByRole("link", { name: /^Today/u });

    await expect(today).toHaveAttribute("aria-current", "page");
    await expect(today).toHaveAccessibleName(/^Today\s*\d+ activit(?:y|ies) left$/u);

    await expect(tabs.getByRole("link", { name: "Plan" })).toHaveAttribute("href", "/plan");
    await expect(tabs.getByRole("link", { name: /^Zu/u })).toHaveAttribute("href", "/buddy");

    // The goal's own places (an exam's page) between the notebook and the statistics.
    await expect(study.getByRole("link")).toHaveText([/^Mistakes notebook/u, "Exam", "Statistics"]);

    // The goal and search on top; the account at the end, one row with the learner's name and
    // their belt and level that opens the account menu (Statistics is above, and in the menu).
    // Energy lives on the buddy's page, and the phone's bars are gone.
    const account = sidebar.getByRole("button", { name: /, \w+ belt, level \d+, User menu$/u });

    await expect(sidebar.getByRole("button", { name: /Current goal: E2E exam/u })).toBeVisible();
    await expect(account).toBeVisible();
    await expect(sidebar.getByRole("link", { name: /belt, level/u })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Energy/u })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Learning tabs" })).toHaveCount(1);
    await expect(page.getByRole("banner")).toHaveCount(0);

    // The first stop skips the frame: past it, the next stop is the page's main action.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("main").getByRole("button", { name: /^Start/u })).toBeFocused();

    // Tab order is reading order: the goal, search, the three tabs, the study shortcuts and the
    // account. Enter opens a tab.
    await sidebar.getByRole("button", { name: /Current goal/u }).focus();
    await page.keyboard.press("Tab");
    await expect(sidebar.getByRole("button", { name: "Search or ask…" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(today).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(tabs.getByRole("link", { name: "Plan" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(tabs.getByRole("link", { name: /^Zu/u })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(study.getByRole("link", { name: /^Mistakes notebook/u })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(study.getByRole("link", { name: "Exam" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(study.getByRole("link", { name: "Statistics" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(account).toBeFocused();

    await tabs.getByRole("link", { name: /^Zu/u }).focus();
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
    await expect(tabs.getByRole("link")).toHaveText(["Today", "Plan", /^Zu/u]);

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

    // Starting a goal happens in the app too, with no tab bar: until the plan exists the tabs would
    // only lead to a half-made one, and onboarding's bar has the way back.
    await page.goto("/start");
    await expect(page.getByRole("textbox", { name: "I want to" })).toBeVisible();
    await expect(tabs).toHaveCount(0);
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

      await expect(
        page.getByRole("heading", { level: 1, name: "Mistakes notebook" }),
      ).toBeVisible();

      // Nothing from the app bar: the goal and the account belong to the tabs' own pages.
      await expect(page.getByRole("button", { name: /Current goal/u })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "User menu" })).toHaveCount(0);

      // Its way back returns to the page it was opened from, whichever it was: Today here.
      const back = page.getByRole("link", { exact: true, name: "Back" });
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

  test("on a laptop, the page's bar keeps the way back and its actions while the sidebar keeps the tabs", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "hugeGoal" }, async ({ page, user }) => {
      const chapterId = await findPlanChapterId(user.goalId, CHAPTER);

      await page.setViewportSize({ height: 860, width: 1280 });
      await page.goto(`/content/chapters/${chapterId}`);
      await expect(page.getByRole("heading", { level: 1, name: CHAPTER })).toBeVisible();

      // The sidebar keeps the goal and the tabs; the page's bar has the way back and its actions.
      await expect(
        page
          .getByRole("complementary", { name: "Sidebar" })
          .getByRole("button", { name: /Current goal/u }),
      ).toBeVisible();

      await expect(page.getByRole("link", { name: "Back to Plan" })).toBeVisible();

      await expect(page.getByRole("button", { name: "Ask Zu about this chapter" })).toBeVisible();

      await expect(page.getByRole("button", { name: "Chapter options" })).toBeVisible();

      const tabs = page.getByRole("navigation", { name: "Learning tabs" });
      await expect(tabs).toHaveCount(1);

      await expect(tabs.getByRole("link", { name: "Plan" })).toHaveAttribute(
        "aria-current",
        "page",
      );

      // Opened directly, there's no page to return to: the way back leads to the Plan.
      await page.getByRole("link", { name: "Back to Plan" }).click();
      await expect(page).toHaveURL(/\/plan$/u);
    });
  });

  test("a page from an old link says it isn't there inside the app, keeping the tabs and the way back", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page }) => {
      await page.setViewportSize({ height: 844, width: 390 });
      await page.goto("/plan/not-a-subject");

      await expect(page.getByRole("heading", { name: "We couldn't find this page" })).toBeVisible();

      // The app's frame stays around the message, instead of the public site's footer.
      const tabs = page.getByRole("navigation", { name: "Learning tabs" });

      await expect(tabs.getByRole("link", { exact: true, name: "Plan" })).toHaveAttribute(
        "aria-current",
        "page",
      );

      await expect(page.getByRole("contentinfo")).toHaveCount(0);

      await page.getByRole("link", { name: "Back to Plan" }).click();
      await expect(page).toHaveURL(/\/plan$/u);
    });
  });

  test("a task from an old link says it isn't there in the task's own frame, and leaving goes to Today", async ({
    authenticatedPage: page,
  }) => {
    await expectTaskNotFound(page, `/learn/${crypto.randomUUID()}`);
    await expectTaskNotFound(page, `/mock/${crypto.randomUUID()}`);

    await page.getByRole("link", { name: "Leave" }).click();
    await expect(page).toHaveURL(/\/today$/u);
  });
});
