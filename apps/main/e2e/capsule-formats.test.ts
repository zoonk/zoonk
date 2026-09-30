import { randomUUID } from "node:crypto";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { statement } from "./exam-fixtures";
import { expect, test } from "./fixtures";
import { type Mode } from "./learn-personas";
import { openAs } from "./study-day";

const PAIRS = [
  { left: "10% of 50", right: "5" },
  { left: "25% of 40", right: "10" },
  { left: "50% of 30", right: "15" },
];

/**
 * A learner whose day opens with two capsules: true-or-false statements scored net, as in
 * Cebraspe exams (a wrong answer cancels a right one), and one match-pairs question.
 */
async function createCapsuleDay(mode: Mode) {
  const [user, skill, lesson] = await Promise.all([
    createE2EUser(getBaseURL()),
    skillFixture({ name: `Administrative law ${randomUUID()}` }),
    libraryLessonFixture({ title: "Tenure" }),
  ]);

  const goal = await goalFixture({ kind: "exam", timezone: "UTC", userId: user.id });
  const plan = await planFixture({ goalId: goal.id });

  const [statements, match, session] = await Promise.all([
    Promise.all(
      [
        statement("First statement", true),
        statement("Second statement", false),
        statement("Third statement", true),
      ].map((content) => itemFixture({ content, format: "trueFalse", skillId: skill.id })),
    ),
    itemFixture({
      content: { pairs: PAIRS, question: "Match each percentage", reason: "Multiply." },
      format: "matchPairs",
      skillId: skill.id,
    }),
    studySessionFixture({ goalId: goal.id, userId: user.id }),
    planItemFixture({ kind: "lesson", lessonId: lesson.id, planId: plan.id, position: 0 }),
    learningProfileFixture({
      activeGoalId: goal.id,
      experienceMode: mode,
      userId: user.id,
      ...(mode === "fun" ? { buddyKind: "zu" } : {}),
    }),
  ]);

  await studySessionBlockFixture({
    estimatedMinutes: 3,
    kind: "review",
    payload: {
      capsules: [
        {
          format: "swipe",
          itemIds: statements.map((item) => item.id),
          key: `skill:${skill.id}`,
          lessonId: null,
          skillIds: [skill.id],
          title: "Administrative law",
        },
        {
          format: "matchPairs",
          itemIds: [match.id],
          key: lesson.id,
          lessonId: lesson.id,
          skillIds: [skill.id],
          title: "Percentages",
        },
      ],
      skillIds: [skill.id],
    },
    position: 0,
    sessionId: session.id,
  });

  return { user };
}

test.describe("Capsules", () => {
  test("swipe with a net score, then match pairs", async ({ browser }) => {
    const { user } = await createCapsuleDay("focus");
    const page = await openAs(browser, user);
    await page.goto("/session");
    await page.getByRole("button", { name: /^Start/u }).click();

    // True, right.
    await expect(page.getByText(/^First statement/u)).toBeVisible();

    await expect(
      page.getByText("A wrong answer cancels a right one. Not sure? Leave it blank."),
    ).toBeVisible();

    await page.getByRole("button", { name: /^True/u }).click();

    await expect(
      page.getByRole("region", { name: "Answer feedback" }).getByText("Correct!"),
    ).toBeVisible();

    await expect(page.getByText("1 right")).toBeVisible();
    await page.keyboard.press("Enter");

    // Left blank: it cancels nothing.
    await expect(page.getByText(/^Second statement/u)).toBeVisible();
    await page.getByRole("button", { name: "Leave blank" }).click();

    await expect(
      page.getByRole("region", { name: "Answer feedback" }).getByText("Not quite"),
    ).toBeVisible();

    await expect(page.getByText("0 wrong")).toBeVisible();
    await expect(page.getByText("net 1")).toBeVisible();
    await page.keyboard.press("Enter");

    // False on a true statement, from the keyboard: the net drops back to zero.
    await expect(page.getByText(/^Third statement/u)).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByText("net 0")).toBeVisible();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { name: "Match each percentage" })).toBeVisible();

    await PAIRS.reduce(async (previous, pair) => {
      await previous;
      await page.getByRole("button", { exact: true, name: pair.left }).click();
      await page.getByRole("button", { exact: true, name: pair.right }).click();
    }, Promise.resolve());

    await page.getByRole("button", { name: "Check" }).click();

    await expect(
      page.getByRole("region", { name: "Answer feedback" }).getByText("Correct!"),
    ).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(page.getByText("Net score 1: 2 right, 1 wrong")).toBeVisible();
    await page.context().close();
  });

  test("the same capsules by keyboard alone: number keys answer, Enter goes on", async ({
    browser,
  }) => {
    const { user } = await createCapsuleDay("fun");
    const page = await openAs(browser, user);
    await page.setViewportSize({ height: 900, width: 1280 });
    await page.goto("/session");

    const feedback = page.getByRole("region", { name: "Answer feedback" });

    // Enter's listener attaches as the page hydrates, so the first press retries.
    await expect(async () => {
      await page.keyboard.press("Enter");
      await expect(page.getByText(/^First statement/u)).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 5000 });

    // Numbers follow the buttons: 1 false, 2 leave blank, 3 true.
    await page.keyboard.press("3");
    await expect(feedback.getByText("Correct!")).toBeVisible();
    await page.keyboard.press("Enter");

    await expect(page.getByText(/^Second statement/u)).toBeVisible();
    await page.keyboard.press("2");
    await expect(feedback.getByText("Not quite")).toBeVisible();
    await expect(page.getByText("net 1")).toBeVisible();
    await page.keyboard.press("Enter");

    await expect(page.getByText(/^Third statement/u)).toBeVisible();
    await page.keyboard.press("3");
    await expect(feedback.getByText("Correct!")).toBeVisible();
    await expect(page.getByText("net 2")).toBeVisible();
    await page.keyboard.press("Enter");

    // Match pairs: a number picks on the left, then its match on the right; Enter checks.
    await expect(page.getByRole("heading", { name: "Match each percentage" })).toBeVisible();

    const rights = await page
      .getByRole("list", { name: "With these" })
      .getByRole("button")
      .allTextContents();

    for (const [index, pair] of PAIRS.entries()) {
      // oxlint-disable-next-line no-await-in-loop -- Each pair is picked in turn.
      await page.keyboard.press(String(index + 1));
      // oxlint-disable-next-line no-await-in-loop -- Each pair is picked in turn.
      await page.keyboard.press(String(rights.indexOf(pair.right) + 1));
    }

    await page.keyboard.press("Enter");
    await expect(feedback.getByText("Correct!")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Net score 3: 3 right, 0 wrong")).toBeVisible();
    await page.context().close();
  });
});
