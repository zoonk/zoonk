import { randomUUID } from "node:crypto";
import { type Page } from "@playwright/test";
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
import { formatMathAnswer } from "@zoonk/utils/math-answer";
import { expect, test } from "./fixtures";
import { type Mode } from "./learn-personas";
import { openAs } from "./study-day";

const SAVED_REASON = "That's what you save. You pay what's left after it.";

/**
 * The ENEM discount problem as the item bank stores it: the numbers are variables with ranges, so
 * each block asks it with its own price and discount.
 */
function discountContent(label: string) {
  const price = { max: 400, min: 40, step: 10 };
  const rate = { max: 60, min: 5, step: 5 };

  return {
    context: null,
    math: {
      answer: 102,
      commonMistakes: [
        {
          expression: "price * rate / 100",
          misconception: "Answered with the discount instead of the price paid",
          reason: SAVED_REASON,
        },
        {
          expression: "price - rate",
          misconception: "Subtracted the percent as if it were reais",
          reason: "A percent of the price isn't that many reais.",
        },
      ],
      solution: "price * (1 - rate / 100)",
      steps: [
        { expression: null, text: "You pay what's left: 100% − {rate}%." },
        { expression: "price * (1 - rate / 100)", text: "{price} × (1 − {rate}/100) = {result}" },
      ],
      tolerance: { kind: "absolute", value: 0.01 },
      unit: "R$",
      variables: [
        { ...price, name: "price", unit: "R$", value: price.min },
        { ...rate, name: "rate", unit: "%", value: rate.min },
      ],
    },
    question: `${label}: an R$ {price} shirt is {rate}% off. How much do you pay, in reais?`,
  };
}

/** An amount as the English feedback writes it: "R$44.20". */
function reais(value: number): string {
  return formatMathAnswer({ language: "en", unit: "R$", value });
}

function toCents(value: number): number {
  return Number(value.toFixed(2));
}

/** The numbers a question shows, what the learner pays and what they save, rounded to cents. */
async function readNumbers(page: Page, label: string) {
  const heading = page.getByRole("heading", { name: new RegExp(`^${label}:`, "u") });
  await expect(heading).toBeVisible();

  const text = (await heading.textContent()) ?? "";

  const [price = 0, rate = 0] = (text.match(/\d+(?:\.\d+)?/gu) ?? []).map((value) => Number(value));

  return { paid: toCents(price * (1 - rate / 100)), saved: toCents((price * rate) / 100) };
}

/** A learner whose day is one practice block: a choice question, then two math problems. */
async function createMathDay({
  mode,
  problems,
}: {
  mode: Mode;
  problems: ReturnType<typeof discountContent>[];
}) {
  const [user, skill, lesson] = await Promise.all([
    createE2EUser(getBaseURL()),
    skillFixture({ name: `Percent discounts ${randomUUID()}` }),
    libraryLessonFixture({ title: "Discounts" }),
  ]);

  const goal = await goalFixture({ kind: "exam", timezone: "UTC", userId: user.id });
  const plan = await planFixture({ goalId: goal.id });

  const [warmUp, math, session] = await Promise.all([
    itemFixture({
      content: {
        context: null,
        options: [
          { isCorrect: true, misconception: null, reason: "Half of 10 is 5.", text: "5" },
          { isCorrect: false, misconception: "Doubles", reason: "That doubles it.", text: "20" },
        ],
        question: "Warm-up: what is half of 10?",
      },
      skillId: skill.id,
    }),
    Promise.all(
      problems.map((content) => itemFixture({ content, format: "numeric", skillId: skill.id })),
    ),
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
    estimatedMinutes: 4,
    kind: "practice",
    payload: { itemIds: [warmUp.id, ...math.map((item) => item.id)], skillIds: [skill.id] },
    position: 0,
    sessionId: session.id,
  });

  return { user };
}

/** Today's session holding one boss that asks one math problem, won with one right answer. */
async function createMathBoss(mode: Mode) {
  const [user, skill] = await Promise.all([
    createE2EUser(getBaseURL()),
    skillFixture({ name: `Percent discounts ${randomUUID()}` }),
  ]);

  const goal = await goalFixture({ timezone: "UTC", userId: user.id });

  const plan = await planFixture({
    goalId: goal.id,
    phases: [{ name: "Basics" }, { name: "Practice" }],
  });

  const [math, boss, session] = await Promise.all([
    itemFixture({ content: discountContent("Boss"), format: "numeric", skillId: skill.id }),
    planItemFixture({ kind: "boss", phase: 0, planId: plan.id, position: 0 }),
    studySessionFixture({ goalId: goal.id, userId: user.id }),
    learningProfileFixture({
      activeGoalId: goal.id,
      experienceMode: mode,
      userId: user.id,
      ...(mode === "fun" ? { buddyKind: "zu" } : {}),
    }),
  ]);

  const block = await studySessionBlockFixture({
    estimatedMinutes: 2,
    kind: "checkpoint",
    payload: {
      checkpoint: {
        kind: "boss",
        mock: false,
        passMark: 1,
        phase: 0,
        rematch: false,
        timeLimitMinutes: null,
      },
      itemIds: [math.id],
      planItemId: boss.id,
      skillIds: [skill.id],
      title: "Basics boss",
    },
    position: 0,
    sessionId: session.id,
  });

  return { block, user };
}

test.describe("Math problems", () => {
  test("answers with the numbers shown, and a common mistake shows the way", async ({
    browser,
  }) => {
    const { user } = await createMathDay({
      mode: "focus",
      problems: [discountContent("Shirt"), discountContent("Jacket")],
    });

    const page = await openAs(browser, user);
    const feedback = page.getByRole("region", { name: "Answer feedback" });
    await page.goto("/session");
    await page.getByRole("button", { name: /^Start/u }).click();

    // Number keys pick options in a choice question.
    await expect(page.getByRole("heading", { name: /^Warm-up/u })).toBeVisible();
    await page.keyboard.press("1");
    await expect(feedback.getByText("Correct!")).toBeVisible();
    await page.keyboard.press("Enter");

    // In a math problem they type into the answer field, next to its unit, and Enter checks.
    const shirt = await readNumbers(page, "Shirt");
    const field = page.getByRole("textbox", { name: "Your answer" });

    await expect(field).toBeFocused();
    await expect(page.getByText("R$", { exact: true })).toBeVisible();
    await page.keyboard.type(String(shirt.paid));
    await expect(field).toHaveValue(String(shirt.paid));
    await page.keyboard.press("Enter");

    await expect(feedback.getByText("Correct!")).toBeVisible();
    await expect(field).toBeDisabled();
    await page.keyboard.press("Enter");

    // Answering with the discount instead of the price paid.
    const jacket = await readNumbers(page, "Jacket");
    await field.fill("abc");
    await page.getByRole("button", { name: /^Check/u }).click();
    await expect(page.getByText("Type a number, like 2.5.")).toBeVisible();

    await field.fill(String(jacket.saved));
    await page.getByRole("button", { name: /^Check/u }).click();

    await expect(feedback.getByText("Not quite")).toBeVisible();
    await expect(feedback.getByText(`Right answer: ${reais(jacket.paid)}`)).toBeVisible();
    await expect(feedback.getByText(SAVED_REASON)).toBeVisible();
    await expect(feedback.getByText("How to solve it")).toBeVisible();

    await expect(
      feedback.getByRole("listitem").filter({ hasText: `= ${jacket.paid}` }),
    ).toBeVisible();

    await expect(feedback.getByText("Saved to your mistakes, so it comes back.")).toBeVisible();
    await page.context().close();
  });

  test("a boss asks a math problem without hints, then shows the way", async ({ browser }) => {
    const { block, user } = await createMathBoss("fun");
    const page = await openAs(browser, user);
    await page.goto(`/checkpoint/${block.id}`);

    // Keys work once the page hydrates, so the first press retries until the duel opens.
    await expect(async () => {
      await page.keyboard.press("Enter");
      await expect(page.getByText("Question 1 of 1")).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 5000 });

    const boss = await readNumbers(page, "Boss");
    await expect(page.getByRole("textbox", { name: "Your answer" })).toBeFocused();
    await page.keyboard.type(String(boss.saved));
    await page.keyboard.press("Enter");

    await expect(page.getByRole("status")).toHaveText("Not this one. You'll see why at the end.");

    await expect(page.getByText(SAVED_REASON)).toHaveCount(0);
    await page.keyboard.press("Enter");

    await page.getByText("Review the answers").click();
    await expect(page.getByText(`Answer: ${reais(boss.paid)}`)).toBeVisible();
    await expect(page.getByText(SAVED_REASON)).toBeVisible();
    await expect(page.getByText(`/100) = ${boss.paid}`)).toBeVisible();
    await page.context().close();
  });
});
