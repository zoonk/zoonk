import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import { type Page, expect, test } from "./fixtures";
import { holdActionAnswer } from "./held-action";
import { asPersona } from "./learn-personas";
import {
  ANSWERED,
  ORDER_STEPS,
  addOrderQuestions,
  answerSeededQuestion,
  createMappedGoal,
  questionOnScreen,
  solvePlacementEquation,
  sortSteps,
  stopTest,
  testLeave,
  testQuestion,
} from "./onboarding-fixtures";

/** A learn goal past onboarding whose topics each have a quick question and three to put in order. */
async function createLearnGoal(userId: string, { onboarding = false } = {}) {
  const goal = await createMappedGoal(userId);

  if (!onboarding) {
    await prisma.goal.update({
      data: {
        details: { answered: [...ANSWERED, "placement"], subject: "algebra" },
        planRevealedAt: new Date(),
      },
      where: { id: goal.id },
    });
  }

  await addOrderQuestions(goal.id);
  return goal;
}

const MOST_QUESTIONS = 8;

const atQuestion = (page: Page, number: number) => expect(testQuestion(page, number)).toBeVisible();

async function answerRight(page: Page) {
  const asked = await questionOnScreen(page);
  const title = page.getByRole("heading", { level: 2, name: /Solve x \+|Put the/u });
  const solution = solvePlacementEquation(await title.innerText());

  if (solution) {
    await page.getByRole("radio", { exact: true, name: solution }).click();
  } else {
    await sortSteps(page, ORDER_STEPS);
  }

  // The drag sensor suppresses clicks for 50 ms after pointer release.
  await page.getByRole("button", { exact: true, name: "Confirm" }).click({ delay: 80 });
  await expect(asked).toBeHidden();
}

const skippedLessons = (goalId: string) =>
  prisma.planItem.count({ where: { plan: { goalId }, status: "testedOut" } });

async function finishTest(page: Page, answer: (page: Page) => Promise<void> = answerRight) {
  await page.getByRole("button", { exact: true, name: "Start" }).click();
  const result = page.getByText("You start here", { exact: true });
  const confirm = page.getByRole("button", { exact: true, name: "Confirm" });

  for (let asked = 0; asked < MOST_QUESTIONS; asked += 1) {
    // oxlint-disable-next-line no-await-in-loop -- Questions come one at a time.
    await expect(confirm.or(result).first()).toBeVisible();

    // oxlint-disable-next-line no-await-in-loop -- Questions come one at a time.
    if (await result.isVisible()) {
      break;
    }

    // oxlint-disable-next-line no-await-in-loop -- Questions come one at a time.
    await answer(page);
  }

  await expect(result).toBeVisible();
}

test.describe("Testing what you know from the plan", () => {
  test("a test finds where the learner starts, skips the lessons before it, and Undo restores them", async ({
    noProgressUser,
    userWithoutProgress: page,
  }, testInfo) => {
    const goal = await createLearnGoal(noProgressUser.id);

    await page.goto("/plan");
    await page.getByRole("link", { name: /Test what you know/u }).click();

    await expect(page.getByRole("heading", { name: "Skip what you already know" })).toBeVisible();
    await expect(page.getByText(/^Up to \d+ questions$/u)).toBeVisible();

    await finishTest(page);
    await expect(page.getByText(/^\d+ of \d+ lessons skipped$/u)).toBeVisible();
    expect(await skippedLessons(goal.id)).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath("placement-result.png") });

    await page.getByRole("button", { exact: true, name: "Undo" }).click();
    await expect(page.getByRole("heading", { name: "No lessons skipped" })).toBeVisible();
    await expect(page.getByText(/^The lessons? (?:is|are) back in your plan\.$/u)).toBeVisible();
    await expect(page.getByRole("button", { exact: true, name: "Undo" })).toBeHidden();
    await expect(page.getByRole("button", { exact: true, name: "Done" })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath("placement-undo.png") });

    await page.getByRole("button", { exact: true, name: "Done" }).click();

    await expect(page.getByRole("link", { name: /Test what you know/u })).toBeVisible();
    expect(await skippedLessons(goal.id)).toBe(0);
  });

  test("a test from Plan only shows question writing while it waits", async ({
    noProgressUser,
    userWithoutProgress: page,
  }, testInfo) => {
    const goal = await createLearnGoal(noProgressUser.id);

    const topics = await prisma.planItem.findMany({
      select: { skillId: true },
      where: { plan: { goalId: goal.id }, skillId: { not: null } },
    });

    await prisma.item.deleteMany({
      where: { skillId: { in: topics.flatMap(({ skillId }) => skillId ?? []) } },
    });

    await page.goto("/placement-test");
    await page.getByRole("button", { exact: true, name: "Start" }).click();

    await expect(
      page.getByText("Writing your questions", { exact: true }).filter({ visible: true }),
    ).toBeVisible();

    // The way on is there from the start of a wait, never after a delay.
    await expect(page.getByRole("button", { exact: true, name: "Not now" })).toBeVisible();

    await expect(page.getByText("Reading your goal", { exact: true })).toBeHidden();
    await expect(page.getByText("Choosing what to learn", { exact: true })).toBeHidden();
    await page.screenshot({ path: testInfo.outputPath("placement-plan-wait.png") });
  });

  test("coming back after another device moved the test on can't answer the question kept on screen", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await createLearnGoal(noProgressUser.id);

    await page.goto("/plan");
    await page.getByRole("link", { name: /Test what you know/u }).click();
    await page.getByRole("button", { exact: true, name: "Start" }).click();
    await atQuestion(page, 1);

    const other = await page.context().newPage();
    await other.goto("/placement-test");
    await atQuestion(other, 1);
    await answerRight(other);
    await atQuestion(other, 2);

    await testLeave(page).click();
    await expect(page).toHaveURL(/\/plan$/u);

    await holdActionAnswer(page, "/placement-test", {
      start: () => page.getByRole("link", { name: /Test what you know/u }).click(),
      whileHeld: async () => {
        // The question kept from the last visit stays on screen, but it can't be answered until
        // this visit has read where the test is.
        await atQuestion(page, 1);
        await expect(page.getByRole("button", { name: "I don't know yet" })).toBeDisabled();
      },
    });

    await atQuestion(page, 2);
    await expect(page.getByRole("button", { name: "I don't know yet" })).toBeEnabled();
  });

  test("an answer to a question another device moved past opens where the test is now", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await createLearnGoal(noProgressUser.id);

    await page.goto("/placement-test");
    await page.getByRole("button", { exact: true, name: "Start" }).click();
    await atQuestion(page, 1);

    const other = await page.context().newPage();
    await other.goto("/placement-test");
    await atQuestion(other, 1);
    await answerRight(other);
    await atQuestion(other, 2);

    await page.getByRole("button", { name: "I don't know yet" }).click();

    await atQuestion(page, 2);
    await expect(page.getByText("That didn't go through. Your answers are kept.")).toBeHidden();
  });

  test("offers no B2 test-out while B2 has no lessons it could skip", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const { goal } = await languageGoalFixture({ userId: noProgressUser.id });

    await prisma.goal.update({
      data: {
        details: {
          answered: [...ANSWERED, "placement"],
          level: "B1",
          levelTest: {
            lastResult: {
              attemptId: null,
              finishedAt: new Date().toISOString(),
              lessonsSkipped: 0,
              levelsSkipped: [],
              ranges: { listening: { high: "B1", low: "A2" }, reading: { high: "B2", low: "B1" } },
            },
          },
        },
        planRevealedAt: new Date(),
      },
      where: { id: goal.id },
    });

    await page.goto("/plan");

    await expect(
      page.getByRole("button", { name: /English level Reading B1–B2\s*Listening A2–B1/u }),
    ).toBeVisible();

    await page.goto("/level-test");

    await expect(page.getByRole("heading", { name: "Skip what you already know" })).toBeVisible();

    await expect(page.getByRole("button", { exact: true, name: "Start" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Test out of B2/u })).toBeHidden();
  });

  test("reopens and scores a test-out whose last answer was saved before finishing", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const { goal, skills } = await languageGoalFixture({ userId: noProgressUser.id });
    const skill = skills.at(0);

    if (!skill) {
      throw new Error("Expected a language topic");
    }

    const item = await itemFixture({ skillId: skill.id });
    const attemptId = crypto.randomUUID();

    await Promise.all([
      attemptFixture({
        focusTestId: attemptId,
        isPlacement: true,
        itemId: item.id,
        skillId: skill.id,
        userId: noProgressUser.id,
      }),
      prisma.goal.update({
        data: {
          details: {
            answered: [...ANSWERED, "placement"],
            level: "B1",
            levelTest: {
              testOut: {
                id: attemptId,
                level: "B2",
                questions: [{ id: item.id, skill: "reading", skillId: skill.id }],
              },
            },
          },
          planRevealedAt: new Date(),
        },
        where: { id: goal.id },
      }),
    ]);

    await page.goto("/level-test");
    await page.getByRole("radio", { name: /Test out of B2/u }).click();
    await page.getByRole("button", { exact: true, name: "Start" }).click();
    await expect(page.getByRole("heading", { name: "Your answers are saved" })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "B2 stays in your plan" })).toBeVisible();
    const finished = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });

    expect(finished.details).toMatchObject({
      levelTest: { testOut: { id: attemptId, result: { finishedAt: expect.any(String) } } },
    });

    expect(await prisma.attempt.count({ where: { focusTestId: attemptId } })).toBe(1);
  });

  test("a test says where the learner is on Plan, and picks up where they left", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await createLearnGoal(noProgressUser.id);

    await page.goto("/placement-test");
    await page.getByRole("button", { exact: true, name: "Start" }).click();
    await atQuestion(page, 1);
    await answerRight(page);

    await page.goto("/plan");

    await expect(
      page.getByRole("link", { name: /Test what you know.*In progress.*Question 2 of \d+/u }),
    ).toBeVisible();

    await page.goto("/placement-test");
    await expect(page.getByRole("button", { name: "I don't know yet" })).toBeVisible();
    await atQuestion(page, 2);

    await page.reload();
    await atQuestion(page, 2);
  });

  test("Stop on a question another tab already answered shows where the test is instead", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await createLearnGoal(noProgressUser.id);

    await page.goto("/placement-test");
    await page.getByRole("button", { exact: true, name: "Start" }).click();
    await atQuestion(page, 1);
    await answerRight(page);
    await atQuestion(page, 2);

    const other = await page.context().newPage();
    await other.goto("/placement-test");
    await atQuestion(other, 2);
    await answerRight(other);
    await atQuestion(other, 3);

    await stopTest(page);

    await atQuestion(page, 3);
    await expect(page.getByText("You start here", { exact: true })).toBeHidden();
  });
});

test("an answer to a test another device stopped shows that test's result", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  await createLearnGoal(noProgressUser.id);

  await page.goto("/placement-test");
  await page.getByRole("button", { exact: true, name: "Start" }).click();
  await atQuestion(page, 1);
  await answerRight(page);
  await atQuestion(page, 2);

  const other = await page.context().newPage();
  await other.goto("/placement-test");
  await atQuestion(other, 2);
  await stopTest(other);
  await expect(other.getByText("You start here", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "I don't know yet" }).click();

  await expect(page.getByText("You start here", { exact: true })).toBeVisible();
  await expect(page.getByText("That didn't go through. Your answers are kept.")).toBeHidden();
});

test("a test's skip appears on Plan and Today and can be undone from Today", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createLearnGoal(noProgressUser.id);

  await page.goto("/placement-test");
  await finishTest(page);
  await page.goto("/plan");

  const card = page.getByRole("region", { name: /^Skipped \d+ lessons? you already know/u });
  const undo = card.getByRole("button", { name: "Undo" });

  await expect(undo).toBeVisible();
  await page.getByRole("link", { exact: true, name: "Today" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/today$/u);
  await expect(page.getByRole("heading", { exact: true, name: "Today" })).toBeVisible();
  await expect(undo).toBeVisible();
  await undo.click();

  await expect(card.getByText(/^The lessons? (?:is|are) back in your plan\.$/u)).toBeVisible();
  expect(await skippedLessons(goal.id)).toBe(0);
});

test("onboarding's test ends on where the learner starts, which a reload keeps", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createLearnGoal(noProgressUser.id, { onboarding: true });

  await page.goto(`/start/${goal.id}`);
  await expect(page.getByRole("heading", { name: "Where would you like to start?" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /^Test/u })).toBeChecked();
  await page.getByRole("button", { exact: true, name: "Start" }).click();
  await atQuestion(page, 1);
  await answerRight(page);

  await stopTest(page);
  const result = page.getByRole("heading", { level: 1 }).filter({ visible: true });
  await expect(page.getByRole("button", { exact: true, name: "Continue" })).toBeVisible();
  const title = await result.innerText();

  await page.reload();
  await expect(result).toHaveText(title);
  await page.getByRole("button", { exact: true, name: "Continue" }).click();

  await expect(page.getByRole("button", { name: "Adjust plan" })).toBeVisible();
});

test("the seeded course's test goes from onboarding's offer to where the learner starts", async ({
  browser,
}, testInfo) => {
  await asPersona(browser, { persona: "stocks", state: "placement" }, async ({ page, user }) => {
    await page.goto(`/start/${user.goalId}`);

    await expect(page.getByRole("radio", { name: /^Test/u })).toBeChecked();
    await expect(page.getByText(/^Up to \d+ questions$/u)).toBeVisible();

    await finishTest(page, answerSeededQuestion);

    await expect(page.getByRole("heading", { level: 1 }).filter({ visible: true })).not.toBeEmpty();
    await expect(page.getByText(/^\d+ of \d+ lessons skipped$/u)).toBeVisible();
    await expect(page.getByText("Up next", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { exact: true, name: "Undo" })).toBeVisible();
    expect(await skippedLessons(user.goalId)).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath("seeded-course-result.png") });

    await page.getByRole("button", { exact: true, name: "Continue" }).click();
    await expect(page.getByRole("button", { name: "Adjust plan" })).toBeVisible();
  });
});

test("a saved retake result explains why it skipped nothing after Undo", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createLearnGoal(noProgressUser.id, { onboarding: true });

  await prisma.goal.update({
    data: {
      details: {
        answered: ANSWERED,
        placementTest: {
          attempt: null,
          result: {
            attemptId: crypto.randomUUID(),
            finishedAt: new Date().toISOString(),
            heldUntilTomorrow: true,
            lessonsSkipped: 0,
          },
        },
        subject: "algebra",
      },
    },
    where: { id: goal.id },
  });

  await page.goto(`/start/${goal.id}`);

  await expect(page.getByRole("heading", { name: "No lessons skipped" })).toBeVisible();

  await expect(
    page.getByText("You undid these today. Answer again tomorrow to skip them."),
  ).toBeVisible();
});
