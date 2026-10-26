import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { expect, test } from "./fixtures";
import { openAs } from "./study-day";

/** A learner with two planned goals, on the first. */
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

/** The learning tabs' goal switcher: every tab reads the goal picked in it. */
test.describe("Learning tabs frame", () => {
  test("the goal switcher switches the goal, and every tab follows", async ({ browser }) => {
    const { second, user } = await createTwoGoalLearner();
    const page = await openAs(browser, user);

    await page.goto("/today");

    await page.getByRole("button", { name: /Current goal: Bake sourdough bread/u }).click();
    await page.getByRole("menuitemradio", { name: "Learn to cook" }).click();

    await expect(page.getByRole("button", { name: /Current goal: Learn to cook/u })).toBeVisible();

    await expect.poll(() => readActiveGoalId(user.id)).toBe(second.id);

    // Before a buddy is picked, its tab shows the default buddy, Zu.
    await page.getByRole("link", { exact: true, name: "Zu" }).click();
    await expect(page).toHaveURL(/\/buddy$/u);

    await expect(page.getByRole("button", { name: /Current goal: Learn to cook/u })).toBeVisible();
    await page.context().close();
  });
});
