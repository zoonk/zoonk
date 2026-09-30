import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { expect, test } from "./fixtures";
import { createModeLearner } from "./fun-rewards-fixtures";
import { openAs } from "./study-day";

/**
 * Whether a lesson has a buddy is the app's call: a learner without one, in Focus, gets no
 * companion from the page. The buddy's own layout in Fun is covered by the player's browser tests.
 */
test.describe("Lesson buddy", () => {
  test("Focus: the same lesson without a buddy", async ({ browser }) => {
    const [{ user }, { lesson }] = await Promise.all([
      createModeLearner("focus"),
      playableLessonFixture(),
    ]);

    const page = await openAs(browser, user);

    await page.goto(`/learn/${lesson.id}`);

    await expect(page.getByText("Guess first · no points")).toBeVisible();
    await expect(page.getByText("Ready when you are.")).toHaveCount(0);
    await page.context().close();
  });
});
