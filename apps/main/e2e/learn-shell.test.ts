import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { expect, test } from "./fixtures";
import { createModeLearner } from "./fun-rewards-fixtures";
import { expectMode } from "./learn-personas";
import { openAs } from "./study-day";

/** A Focus learner with two planned goals, 40 and 15 minutes a day, on the first. */
async function createTwoGoalLearner() {
  const user = await createE2EUser(getBaseURL());

  const [first, second] = await Promise.all([
    goalFixture({ dailyMinutes: 40, title: "Bake sourdough bread", userId: user.id }),
    goalFixture({ dailyMinutes: 15, title: "Learn to cook", userId: user.id }),
  ]);

  await Promise.all([
    planFixture({ goalId: first.id }),
    planFixture({ goalId: second.id }),
    learningProfileFixture({ activeGoalId: first.id, experienceMode: "focus", userId: user.id }),
  ]);

  return { first, second, user };
}

async function readActiveGoalId(userId: string) {
  const profile = await prisma.userLearningProfile.findUnique({ where: { userId } });
  return profile?.activeGoalId;
}

/** The learning tabs' goal switcher: every tab reads the goal picked in it. */
test.describe("Learning tabs frame", () => {
  test("the goal switcher lists each goal's minutes, switches from the keyboard or the palette, and every tab follows", async ({
    browser,
  }) => {
    const { first, second, user } = await createTwoGoalLearner();
    const page = await openAs(browser, user);

    await page.goto("/progress");
    await expectMode(page, "focus");

    const trigger = page.getByRole("button", { name: /Current goal: Bake sourdough bread/u });
    await trigger.click();

    await expect(page.getByText("Today: 55 min")).toBeVisible();

    await expect(page.getByRole("menuitemradio", { name: "Bake sourdough bread" })).toContainText(
      "40 min",
    );

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

    await page.getByRole("link", { name: "Plan" }).click();
    await expect(page).toHaveURL(/\/plan$/u);

    await expect(page.getByRole("button", { name: /Current goal: Learn to cook/u })).toBeVisible();

    // The palette offers only the goals to switch to, not the one on screen.
    await page.getByRole("button", { name: "Search" }).click();
    const palette = page.getByRole("dialog", { name: "Search" });
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

  test("a long goal title stays whole on hover and in the menu on a phone in Fun", async ({
    browser,
  }) => {
    const { goal, user } = await createModeLearner("fun");
    const title = "Understand quantum physics well enough to explain it to my grandmother";

    await Promise.all([
      prisma.goal.update({ data: { title }, where: { id: goal.id } }),
      planFixture({ goalId: goal.id }),
    ]);

    const page = await openAs(browser, user);
    await page.setViewportSize({ height: 812, width: 375 });

    await page.goto("/content");
    await expectMode(page, "fun");

    const trigger = page.getByRole("button", { name: `Current goal: ${title}. Switch goal` });
    await expect(trigger).toHaveAttribute("title", title);

    await trigger.click();
    await expect(page.getByRole("menuitemradio", { name: title })).toBeVisible();
    await page.context().close();
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
