import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { expect, test } from "./fixtures";
import { MODES, asPersona } from "./learn-personas";

/**
 * The learning tabs' frame: the goal switcher, the Focus tabs or the Fun dock, Energy and the
 * account menu. Every tab reads the goal picked in the switcher.
 */
test.describe("Learning tabs frame", () => {
  test("Focus shows the goal, the four tabs and Energy", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "exam" }, async ({ page }) => {
      await page.goto("/plan");

      const tabs = page
        .getByRole("navigation")
        .filter({ has: page.getByRole("link", { name: "Content" }) });

      await expect(page.getByRole("button", { name: /Current goal: ENEM/u })).toBeVisible();
      await expect(tabs.getByRole("link")).toHaveText(["Today", "Plan", "Progress", "Content"]);

      await expect(tabs.getByRole("link", { name: "Plan" })).toHaveAttribute(
        "aria-current",
        "page",
      );

      await expect(page.getByRole("link", { name: /Energy/u })).toHaveAttribute("href", "/energy");

      await expect(page.getByRole("link", { name: /Brain Power/u })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "User menu" })).toBeVisible();
    });
  });

  test("Fun shows the labeled dock with the buddy, the level and Brain Power", async ({
    browser,
  }) => {
    await asPersona(browser, { mode: "fun", persona: "fun" }, async ({ page }) => {
      await page.goto("/content");

      const dock = page
        .getByRole("navigation")
        .filter({ has: page.getByRole("link", { name: "Route" }) });

      await expect(dock.getByRole("link")).toHaveText(["Today", "Route", "Cards", "Otto"]);

      await expect(dock.getByRole("link", { name: "Cards" })).toHaveAttribute(
        "aria-current",
        "page",
      );

      await expect(page.getByRole("link", { name: /Brain Power/u })).toBeVisible();

      await expect(page.getByRole("link", { name: /Energy/u })).toBeVisible();
    });
  });

  test("Fun without a buddy yet shows a plain Buddy item that leads to picking one", async ({
    browser,
  }) => {
    await asPersona(browser, { mode: "fun", persona: "fun" }, async ({ page, user }) => {
      await prisma.userLearningProfile.update({
        data: { buddyKind: null, buddyName: null },
        where: { userId: user.id },
      });

      await page.goto("/content");

      const dock = page
        .getByRole("navigation")
        .filter({ has: page.getByRole("link", { name: "Route" }) });

      await expect(dock.getByRole("link")).toHaveText(["Today", "Route", "Cards", "Buddy"]);

      await dock.getByRole("link", { name: "Buddy" }).click();

      await expect(page.getByRole("heading", { level: 1, name: "Pick your buddy" })).toBeVisible();

      await expect(page.getByRole("link", { name: "Open Appearance" })).toHaveAttribute(
        "href",
        "/settings/appearance",
      );
    });
  });

  for (const mode of MODES) {
    test(`switching goals changes every tab in ${mode}`, async ({ browser }) => {
      await asPersona(browser, { mode, persona: "exam" }, async ({ page, user }) => {
        const second = await goalFixture({ title: "Learn to cook", userId: user.id });
        await planFixture({ goalId: second.id });

        await page.goto("/progress");
        await page.getByRole("button", { name: /Current goal: ENEM/u }).click();
        await page.getByRole("menuitemradio", { name: "Learn to cook" }).click();

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

        await page.getByRole("link", { name: mode === "fun" ? "Route" : "Plan" }).click();

        await expect(
          page.getByRole("button", { name: /Current goal: Learn to cook/u }),
        ).toBeVisible();
      });
    });
  }

  for (const mode of MODES) {
    test(`the goal switcher lists each goal's minutes, the day's total and the catalog in ${mode}`, async ({
      browser,
    }) => {
      await asPersona(browser, { mode, persona: "exam" }, async ({ page, user }) => {
        await prisma.goal.update({ data: { dailyMinutes: 40 }, where: { id: user.goalId } });

        const second = await goalFixture({
          dailyMinutes: 15,
          title: "Learn to cook",
          userId: user.id,
        });

        await planFixture({ goalId: second.id });

        await page.goto("/plan");
        await page.getByRole("button", { name: /Current goal: ENEM/u }).click();

        await expect(page.getByText("Today: 55 min")).toBeVisible();
        await expect(page.getByRole("menuitemradio", { name: /ENEM/u })).toContainText("40 min");

        await expect(page.getByRole("menuitemradio", { name: "Learn to cook" })).toContainText(
          "15 min",
        );

        await expect(page.getByRole("menuitem", { name: "Add a goal" })).toHaveAttribute(
          "href",
          "/start",
        );

        await expect(page.getByRole("menuitem", { name: "Explore courses" })).toHaveAttribute(
          "href",
          "/courses",
        );
      });
    });
  }

  test("a long goal title stays whole on hover and in the menu on a phone in Fun", async ({
    browser,
  }) => {
    await asPersona(browser, { mode: "fun", persona: "fun" }, async ({ page, user }) => {
      const title = "Understand quantum physics well enough to explain it to my grandmother";
      await prisma.goal.update({ data: { title }, where: { id: user.goalId } });
      await page.setViewportSize({ height: 812, width: 375 });

      await page.goto("/content");

      const trigger = page.getByRole("button", { name: `Current goal: ${title}. Switch goal` });
      await expect(trigger).toHaveAttribute("title", title);

      await trigger.click();
      await expect(page.getByRole("menuitemradio", { name: title })).toBeVisible();
    });
  });

  test("the goal switcher works from the keyboard", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "exam" }, async ({ page, user }) => {
      const second = await goalFixture({ title: "Speak English", userId: user.id });
      await planFixture({ goalId: second.id });

      await page.goto("/plan");
      await page.getByRole("button", { name: /Current goal: ENEM/u }).focus();
      await page.keyboard.press("Enter");
      // The menu is in the DOM a frame before it paints with the first goal focused; arrow keys
      // pressed in that gap still go to the trigger.
      await expect(page.getByRole("menuitemradio", { name: /ENEM/u })).toBeFocused();
      await page.keyboard.press("ArrowDown");
      await expect(page.getByRole("menuitemradio", { name: "Speak English" })).toBeFocused();
      await page.keyboard.press("Enter");

      await expect(
        page.getByRole("button", { name: /Current goal: Speak English/u }),
      ).toBeVisible();
    });
  });

  test("visitors without a goal are invited to set one", async ({ page }) => {
    await page.goto("/plan");

    await expect(page.getByRole("heading", { name: "Start with a goal" })).toBeVisible();

    await expect(page.getByRole("main").getByRole("link", { name: "Set a goal" })).toHaveAttribute(
      "href",
      "/start",
    );
  });
});
