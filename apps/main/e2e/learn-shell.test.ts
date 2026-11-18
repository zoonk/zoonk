import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { expectHydrated } from "@zoonk/e2e/hydration";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { expect, test } from "./fixtures";
import { openAs } from "./study-day";
import { createUnstartedDay } from "./unstarted-day-fixtures";

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

test("the loaded mistakes notebook still goes back to the page it was opened from", async ({
  browser,
}) => {
  const { user } = await createTwoGoalLearner();
  const page = await openAs(browser, user);
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/plan");

  const notebook = page
    .getByRole("complementary", { name: "Sidebar" })
    .getByRole("link", { name: "Mistakes notebook" });

  await expectHydrated(notebook);
  await notebook.click();
  await expect(page.getByText(/^Nothing to fix right now/u)).toBeVisible();

  await page.setViewportSize({ height: 844, width: 390 });
  await page.getByRole("link", { exact: true, name: "Back to Plan" }).click();
  await expect(page).toHaveURL(/\/plan$/u);
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

    await listed.goto("/stats");
    await expect(listed.getByRole("link", { name: /^Back to /u })).toBeVisible();

    const unlisted = await openAs(browser, withoutGoal);
    await unlisted.setViewportSize({ height: 900, width: 1440 });
    await unlisted.goto("/completed-lessons");

    await expect(
      unlisted.getByRole("complementary", { name: "Sidebar" }).getByText("Completed lessons"),
    ).toHaveCount(0);

    await expect(unlisted.getByRole("link", { name: "Back to Today" })).toBeVisible();
  });
});

for (const textScale of [1, 2]) {
  // oxlint-disable-next-line vitest/prefer-each -- Playwright does not provide test.each.
  for (const buddyName of ["Professor Bartholomew Jr", "abcdefghijklmnopqrstuvwx"]) {
    test(`a 24-character buddy name keeps the action above the tabs at text x${textScale}: ${buddyName}`, async ({
      browser,
    }) => {
      const day = await createUnstartedDay();
      await learningProfileFixture({ buddyKind: "zu", buddyName, userId: day.user.id });
      const page = await openAs(browser, day.user);
      await page.setViewportSize({ height: 844, width: 390 });
      const standardTextPx = 16;
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Page.setFontSizes", { fontSizes: { standard: standardTextPx * textScale } });
      await page.goto("/today");
      const navigation = page.getByRole("navigation", { name: "Learning tabs" });

      await expect(
        navigation.getByRole("link", { name: new RegExp(buddyName, "u") }),
      ).toBeVisible();

      const action = page.getByRole("button", { name: /^Start\b/u });
      await expect(action).toBeVisible();
      const bar = await navigation.boundingBox();

      if (!bar) {
        throw new Error("The bottom navigation must be present");
      }

      const geometry = await action.evaluate((button) => {
        const box = button.getBoundingClientRect();
        const fractions = [0.25, 0.5, 0.75];

        const exposed = fractions.every((part) => {
          const hit = document.elementFromPoint(box.left + box.width * part, box.bottom - 2);
          return hit === button || (hit !== null && button.contains(hit));
        });

        return { actionBottom: box.bottom, actionTop: box.top, exposed };
      });

      const tabBarRem = 4;
      const borderPx = 1;
      expect(bar.height).toBeCloseTo(tabBarRem * standardTextPx * textScale + borderPx, 1);
      expect(geometry.actionTop).toBeGreaterThanOrEqual(0);
      expect(geometry.actionBottom).toBeLessThanOrEqual(bar.y);
      expect(geometry.exposed).toBe(true);
      await page.context().close();
    });
  }
}
