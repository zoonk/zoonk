import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { planFixture } from "@zoonk/testing/fixtures/goals";
import { createGoalLearner } from "./checkpoint-fixtures";
import { expect, test } from "./fixtures";
import { openAs } from "./study-day";

/** A question saved before the Library rewrote every course: its lesson is gone. */
async function earlierQuestion(userId: string) {
  const thread = await prisma.lessonQuestionThread.create({ data: { kind: "lesson", userId } });

  await prisma.lessonQuestion.create({
    data: {
      answer: "Because **forces come in pairs**: the cart pushes back.",
      contextKind: "lesson",
      contextSnapshot: { course: { title: "Physics" }, lesson: { title: "Newton's laws" } },
      question: "Why does the cart move back?",
      requestFingerprint: randomUUID(),
      requestId: randomUUID(),
      status: "completed",
      threadId: thread.id,
    },
  });
}

test.describe("Earlier questions", () => {
  // A returning learner's tutor history from before the rewrite reads as data loss if it vanishes.
  test("keeps a returning learner's questions from an earlier version of their course", async ({
    browser,
  }) => {
    const { goal, user } = await createGoalLearner();
    await Promise.all([planFixture({ goalId: goal.id }), earlierQuestion(user.id)]);

    const page = await openAs(browser, user);
    await page.goto("/buddy");

    await page
      .getByRole("main")
      .getByRole("button", { name: /^More about/u })
      .click();

    await page.getByRole("menuitem", { name: "Earlier questions" }).click();

    await expect(page).toHaveURL(/\/buddy\/earlier-questions$/u);
    await expect(page.getByRole("heading", { level: 1, name: "Earlier questions" })).toBeVisible();

    const entry = page.getByRole("listitem").filter({ hasText: "Why does the cart move back?" });

    await expect(
      entry.getByText("From an earlier version of Physics · Newton's laws"),
    ).toBeVisible();

    await expect(entry.getByText("forces come in pairs")).toBeVisible();
    await expect(entry.getByRole("link")).toHaveCount(0);

    await expectAccessibleScreen(page, "earlier questions");
    await page.context().close();
  });

  // A learner back from before the rewrite has no goal yet: the buddy's menu isn't there, so its
  // first screen offers the history instead.
  test("offers a returning learner without a goal their earlier questions", async ({ browser }) => {
    const user = await createE2EUser(getBaseURL());
    await earlierQuestion(user.id);

    const page = await openAs(browser, user);
    await page.goto("/buddy");

    await page.getByRole("main").getByRole("link", { name: "Earlier questions" }).click();

    await expect(page).toHaveURL(/\/buddy\/earlier-questions$/u);
    await expect(page.getByText("Why does the cart move back?")).toBeVisible();
    await page.context().close();
  });

  test("offers nothing to a learner without earlier questions", async ({ browser }) => {
    const { goal, user } = await createGoalLearner();
    await planFixture({ goalId: goal.id });

    const page = await openAs(browser, user);
    await page.goto("/buddy");

    await page
      .getByRole("main")
      .getByRole("button", { name: /^More about/u })
      .click();

    await expect(page.getByRole("menuitem", { name: "Weekly summary" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Earlier questions" })).toHaveCount(0);
    await page.context().close();
  });
});
