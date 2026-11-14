import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { expectHydrated } from "@zoonk/e2e/hydration";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { expect, test } from "./fixtures";
import { openAs } from "./study-day";

async function createTwoGoalLearner() {
  const user = await createE2EUser(getBaseURL());

  const [first, second] = await Promise.all([
    goalFixture({ title: "Bake sourdough bread", userId: user.id }),
    goalFixture({ title: "Learn to cook", userId: user.id }),
  ]);

  await Promise.all([
    planFixture({ goalId: first.id }),
    planFixture({ goalId: second.id }),
    learningProfileFixture({ activeGoalId: first.id, userId: user.id }),
  ]);

  return { first, second, user };
}

async function readActiveGoalId(userId: string) {
  const profile = await prisma.userLearningProfile.findUnique({ where: { userId } });
  return profile?.activeGoalId;
}

test.describe("Learning tabs frame", () => {
  test("the goal switcher switches the goal, and every tab follows", async ({ browser }) => {
    const { second, user } = await createTwoGoalLearner();
    const page = await openAs(browser, user);

    await page.goto("/today");

    const switchGoal = page.getByRole("button", { name: /^Bake sourdough bread.*Switch goal$/u });
    await expectHydrated(switchGoal);
    await switchGoal.click();
    await page.getByRole("menuitemradio", { name: "Learn to cook" }).click();

    await expect(page.getByRole("button", { name: /^Learn to cook.*Switch goal$/u })).toBeVisible();

    await expect.poll(() => readActiveGoalId(user.id)).toBe(second.id);

    await page.getByRole("link", { exact: true, name: "Zu" }).click();
    await expect(page).toHaveURL(/\/buddy$/u);

    await expect(page.getByRole("button", { name: /^Learn to cook.*Switch goal$/u })).toBeVisible();
    await page.context().close();
  });
});

test.describe("The way back on a computer", () => {
  test("a page the learner's sidebar lists has none, and one it doesn't list keeps it", async ({
    browser,
  }) => {
    const [withGoal, withoutGoal] = await Promise.all([
      createTwoGoalLearner(),
      createE2EUser(getBaseURL()),
    ]);

    const listed = await openAs(browser, withGoal.user);
    await listed.setViewportSize({ height: 900, width: 1440 });
    await listed.goto("/mistakes");

    const sidebar = listed.getByRole("complementary", { name: "Sidebar" });

    await expect(sidebar.getByRole("link", { name: "Mistakes notebook" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    const listedBack = listed.getByRole("link", { includeHidden: true, name: "Back to Today" });
    await expect(listedBack).toHaveCount(1);
    await expect(listedBack).toBeHidden();

    const unlisted = await openAs(browser, withoutGoal);
    await unlisted.setViewportSize({ height: 900, width: 1440 });
    await unlisted.goto("/completed-lessons");

    await expect(
      unlisted.getByRole("complementary", { name: "Sidebar" }).getByText("Completed lessons"),
    ).toHaveCount(0);

    await expect(unlisted.getByRole("link", { name: "Back to Today" })).toBeVisible();
  });
});
