import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { type Page, expect, test } from "./fixtures";
import { openAs } from "./study-day";

const DAYS_TO_EXAM = 32;
const REASON = "Martedì is Tuesday and giovedì is Thursday.";

const PAIRS = [
  { left: "il martedì", right: "Tuesday" },
  { left: "il giovedì", right: "Thursday" },
  { left: "la sera", right: "the evening" },
];

/** Today's session: one review block whose only question is a learning match. */
async function createReviewMatch() {
  const [user, skill] = await Promise.all([
    createE2EUser(getBaseURL()),
    skillFixture({ name: `Days in Italian ${randomUUID()}` }),
  ]);

  const [item, goal] = await Promise.all([
    itemFixture({
      content: {
        pairs: PAIRS,
        question: "Match each Italian word with its meaning",
        reason: REASON,
      },
      format: "matchPairs",
      skillId: skill.id,
    }),
    goalFixture({
      dailyMinutes: 10,
      kind: "exam",
      targetDate: new Date(toUTCMidnight(new Date()).getTime() + DAYS_TO_EXAM * MS_PER_DAY),
      timezone: "UTC",
      title: `E2E Italian ${randomUUID().slice(0, 6)}`,
      userId: user.id,
    }),
  ]);

  const [, session] = await Promise.all([
    planFixture({ goalId: goal.id }),
    studySessionFixture({ goalId: goal.id, plannedMinutes: 5, userId: user.id }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  await studySessionBlockFixture({
    estimatedMinutes: 2,
    kind: "review",
    payload: {
      capsules: [
        {
          format: "matchPairs",
          itemIds: [item.id],
          key: `skill:${skill.id}`,
          lessonId: null,
          skillIds: [skill.id],
          title: "Days",
        },
      ],
      skillIds: [skill.id],
    },
    position: 0,
    sessionId: session.id,
  });

  return { item, user };
}

function card(page: Page, name: string) {
  return page.getByRole("main").getByRole("button", { exact: true, name });
}

test.describe("Review match", () => {
  test("checks each pair as it's made and sends the board, wrong tries included, on the last pair", async ({
    browser,
  }) => {
    const { item, user } = await createReviewMatch();
    const page = await openAs(browser, user);
    await page.goto("/session");

    await page.getByRole("main").getByRole("button", { exact: true, name: "Start" }).click();
    const next = page.getByRole("button", { name: /^Continue/u });
    await expect(next).toBeDisabled();
    await expect(page.getByRole("button", { name: /^Check/u })).toHaveCount(0);

    await card(page, "il martedì").click();
    await card(page, "Thursday").click();
    await expect(card(page, "il martedì")).toHaveAttribute("aria-pressed", "true");

    await card(page, "Tuesday").click();
    await card(page, "il giovedì").click();
    await card(page, "Thursday").click();
    await card(page, "la sera").click();
    await card(page, "the evening").click();

    const feedback = page.getByRole("region", { name: "Answer feedback" });
    const miss = feedback.getByText("il martedì → Thursday");
    await expect(feedback.getByText("Not quite")).toBeVisible();
    await expect(miss).toBeVisible();
    await expect(feedback.getByText(REASON)).toBeVisible();
    await expect(next).toBeEnabled();
    await expect(next).toBeFocused();

    const attempt = await prisma.attempt.findFirstOrThrow({
      where: { itemId: item.id, userId: user.id },
    });

    expect(attempt.isCorrect).toBe(false);
    expect(attempt.answer).toMatchObject({ misses: [{ left: 0 }] });
  });
});
