import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
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
import { expect, test } from "./fixtures";
import { openAs } from "./study-day";

/** An SAT grid-in: the share of a pizza left, typed as a fraction or a long enough decimal. */
const PIZZA = {
  context: null,
  entry: { kind: "fraction", places: null },
  math: {
    answer: 2 / 3,
    commonMistakes: [
      {
        expression: "eaten / slices",
        misconception: "Eaten share",
        reason: "That's what you ate.",
      },
    ],
    solution: "(slices - eaten) / slices",
    steps: [{ expression: null, text: "What's left is {slices} minus {eaten}, over {slices}." }],
    tolerance: { kind: "absolute", value: 0.005 },
    unit: null,
    variables: [
      { max: 3, min: 3, name: "slices", step: 1, unit: null, value: 3 },
      { max: 1, min: 1, name: "eaten", step: 1, unit: null, value: 1 },
    ],
  },
  otherSolutions: [],
  question: "Pizza: a pizza has {slices} slices and you eat {eaten}. What share is left?",
};

/** A "select all that apply" question with two right options of four. */
const DOSES = {
  context: "A patient takes 1 g of paracetamol every 6 hours, and the daily limit is 4 g.",
  fixedOrder: false,
  options: [
    { isCorrect: true, misconception: null, reason: "Four doses of 1 g.", text: "4 g a day" },
    { isCorrect: true, misconception: null, reason: "It's right at the limit.", text: "Safe" },
    {
      isCorrect: false,
      misconception: "Counts 12 hours",
      reason: "It's every 6 hours.",
      text: "2 g a day",
    },
    {
      isCorrect: false,
      misconception: "Misreads the limit",
      reason: "4 g is allowed.",
      text: "Over the limit",
    },
  ],
  question: "Doses: select all that apply.",
  select: "all",
};

/** A word typed into a gap: "went" is accepted as typed, so no model grades it. */
const PAST_TENSE = {
  acceptedAnswers: ["went"],
  context: null,
  keyPoints: ["Uses the past tense of go"],
  question: "Past tense: yesterday she ____ (go) to school.",
  sampleAnswer: "went",
};

const PHASES = ["Prophase", "Metaphase", "Anaphase", "Telophase"];

const MITOSIS = {
  question: "Mitosis: put the phases in order.",
  reason: "Chromosomes condense, line up, split, and then two nuclei form.",
  steps: PHASES,
};

/** A learner whose day is one practice block asking the four exam answer formats. */
async function createFormatsDay() {
  const [user, skill, lesson] = await Promise.all([
    createE2EUser(getBaseURL()),
    skillFixture({ name: `Exam formats ${randomUUID()}` }),
    libraryLessonFixture({ title: "Exam formats" }),
  ]);

  const goal = await goalFixture({ kind: "exam", timezone: "UTC", userId: user.id });
  const plan = await planFixture({ goalId: goal.id });

  const [items, session] = await Promise.all([
    Promise.all(
      [
        { content: PIZZA, format: "numeric" as const },
        { content: DOSES, format: "multipleChoice" as const },
        { content: PAST_TENSE, format: "typed" as const },
        { content: MITOSIS, format: "order" as const },
      ].map((item) => itemFixture({ ...item, skillId: skill.id })),
    ),
    studySessionFixture({ goalId: goal.id, userId: user.id }),
    planItemFixture({ kind: "lesson", lessonId: lesson.id, planId: plan.id, position: 0 }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  await studySessionBlockFixture({
    estimatedMinutes: 6,
    kind: "practice",
    payload: { itemIds: items.map((item) => item.id), skillIds: [skill.id] },
    position: 0,
    sessionId: session.id,
  });

  return { itemIds: items.map((item) => item.id), user };
}

test.describe("Exam answer formats in practice", () => {
  test("answers a fraction, every right option, a typed word and an order", async ({ browser }) => {
    const { itemIds, user } = await createFormatsDay();
    const page = await openAs(browser, user);
    const feedback = page.getByRole("region", { name: "Answer feedback" });
    await page.goto("/session");
    await page.getByRole("button", { name: /^Start/u }).click();

    // A grid-in takes a fraction, and says how the answer box takes it.
    await expect(page.getByRole("heading", { name: /^Pizza/u })).toBeVisible();
    await expect(page.getByText("A fraction, like 2/3, or a decimal.")).toBeVisible();
    await page.getByRole("textbox", { name: "Your answer" }).fill("2/3");
    await page.keyboard.press("Enter");
    await expect(feedback.getByText("Correct!")).toBeVisible();
    await page.getByRole("button", { name: /^Continue/u }).click();

    // Select all that apply: Check waits for a pick, and missing a right option is wrong.
    await expect(page.getByRole("heading", { name: /^Doses/u })).toBeVisible();
    await expect(page.getByText("Select all that apply.", { exact: true })).toBeVisible();
    const check = page.getByRole("button", { name: /^Check/u });
    await expect(check).toBeDisabled();
    await page.getByRole("checkbox", { name: "4 g a day" }).click();
    await expect(page.getByRole("checkbox", { name: "4 g a day" })).toBeChecked();

    await check.click();
    await expect(feedback.getByText("Not quite")).toBeVisible();
    // The missed right option says Correct; the picked one keeps its Your answer label.
    await expect(page.getByRole("checkbox", { name: /Safe.*Correct/u })).toBeDisabled();
    const pickedAnswer = page.getByRole("checkbox", { name: "4 g a day Your answer" });
    await expect(pickedAnswer).toBeVisible();
    await expect(pickedAnswer).toBeChecked();
    await expect(pickedAnswer).toBeDisabled();
    await page.getByRole("button", { name: /^Continue/u }).click();

    // A typed word is accepted as typed, ignoring case and the full stop.
    await expect(page.getByRole("heading", { name: /^Past tense/u })).toBeVisible();
    await page.getByRole("textbox", { name: "Your answer" }).fill("Went.");
    await page.keyboard.press("Enter");
    await expect(feedback.getByText("Correct!")).toBeVisible();
    await page.getByRole("button", { name: /^Continue/u }).click();

    // An order: tap the steps in order; a tapped step can be taken out again.
    await expect(page.getByRole("heading", { name: /^Mitosis/u })).toBeVisible();
    await expect(page.getByText("Tap the steps in order.")).toBeVisible();
    const metaphase = page.getByRole("checkbox", { name: "Metaphase" });
    await metaphase.click();
    await expect(metaphase).toBeChecked();
    await metaphase.click();
    await expect(metaphase).not.toBeChecked();

    await page.getByRole("checkbox", { name: "Prophase" }).click();
    await page.getByRole("checkbox", { name: "Metaphase" }).click();
    await page.getByRole("checkbox", { name: "Anaphase" }).click();
    await page.getByRole("checkbox", { name: "Telophase" }).click();
    await page.getByRole("button", { name: /^Check/u }).click();
    await expect(feedback.getByText("Correct!")).toBeVisible();

    const attempts = await prisma.attempt.findMany({ where: { itemId: { in: itemIds } } });

    expect(
      attempts.map((attempt) => attempt.isCorrect).toSorted((a, b) => Number(a) - Number(b)),
    ).toStrictEqual([false, true, true, true]);

    await page.context().close();
  });
});
