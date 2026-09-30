import {
  learnerSourceFixture,
  sourceChangeNoticeFixture,
  sourceFixture,
} from "@zoonk/testing/fixtures/sources";
import { expect, test } from "./fixtures";
import { MODES } from "./learn-personas";
import { createStudyDay, openAs } from "./study-day";

const MESSAGE = "The exam notice changed: the test now has 60 questions.";

/** A notice the learner studies from, linked to the goal, that changed after the goal started. */
async function addChangedNotice({ goalId, userId }: { goalId: string; userId: string }) {
  const source = await sourceFixture();
  await learnerSourceFixture({ goalId, origin: "research", sourceId: source.id, userId });
  await sourceChangeNoticeFixture({ message: MESSAGE, sourceId: source.id });
}

test.describe("Source change notice on Today", () => {
  for (const mode of MODES) {
    test(`${mode}: says in one line what changed in the goal's notice`, async ({ browser }) => {
      const { goal, user } = await createStudyDay({ mode });
      await addChangedNotice({ goalId: goal.id, userId: user.id });

      const page = await openAs(browser, user);
      await page.goto("/today");

      await expect(page.getByRole("complementary", { name: "What changed" })).toHaveText(MESSAGE);
      await page.context().close();
    });
  }

  test("shows nothing when no source changed", async ({ browser }) => {
    const { user } = await createStudyDay({ mode: "focus" });
    const page = await openAs(browser, user);
    await page.goto("/today");

    await expect(page.getByRole("region", { name: "Today's session" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "What changed" })).toBeHidden();
    await page.context().close();
  });
});
