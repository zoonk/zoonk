import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { type Page, expect, test } from "./fixtures";
import { holdActionAnswer } from "./held-action";
import {
  ANSWERED,
  createMappedGoal,
  solvePlacementEquation,
  stopTest,
  testQuestion,
} from "./onboarding-fixtures";

const STEPS = [
  "Write the equation",
  "Undo the addition",
  "Simplify both sides",
  "Check the answer",
];

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

  const items = await prisma.planItem.findMany({
    select: { skillId: true },
    where: { plan: { goalId: goal.id }, skillId: { not: null } },
  });

  await Promise.all(
    [...new Set(items.flatMap((item) => item.skillId ?? []))].flatMap((skillId) =>
      ["first", "second", "third"].map((copy) =>
        itemFixture({
          content: {
            question: `Put the ${copy} steps in order.`,
            reason: "In order.",
            steps: STEPS,
          },
          format: "order",
          skillId,
        }),
      ),
    ),
  );

  return goal;
}

async function sortSteps(page: Page) {
  const list = page.getByRole("list", { name: "Steps, in your order" });
  const rows = list.getByRole("button");
  await expect(rows).toHaveCount(STEPS.length);
  await expect(rows.first()).toBeEnabled();

  // Each move starts from the order left by the last one.
  /* oxlint-disable no-await-in-loop */
  for (const [target, step] of STEPS.entries()) {
    const destination = rows.nth(target);

    if ((await destination.textContent()) !== step) {
      const row = list.getByRole("button", { exact: true, name: step });
      await row.dragTo(destination, { steps: 12 });
      await expect(destination).toHaveText(step);
    }
  }
  /* oxlint-enable no-await-in-loop */
}

const atQuestion = (page: Page, number: number) =>
  expect(testQuestion(page, number, 12)).toBeVisible();

async function answerRight(page: Page) {
  const title = page.getByRole("heading", { level: 2, name: /Solve x \+|Put the/u });
  const text = await title.innerText();
  const solution = solvePlacementEquation(text);

  if (solution) {
    await page.getByRole("radio", { exact: true, name: solution }).click();
  } else {
    await sortSteps(page);
  }

  // The drag sensor suppresses clicks for 50 ms after pointer release.
  await page.getByRole("button", { exact: true, name: "Confirm" }).click({ delay: 80 });
  await expect(title.filter({ hasText: text })).toBeHidden();
}

const skippedLessons = (goalId: string) =>
  prisma.planItem.count({ where: { plan: { goalId }, status: "testedOut" } });

type TwoPartTest = { first: string; goalId: string; id: string; second: string };

/** A full test with one topic in each part and no questions yet; `atPart` is where it stands. */
async function placeFullTest(
  full: Omit<TwoPartTest, "id"> & { id?: string },
  { atPart = 1, preparationFailed = false } = {},
): Promise<TwoPartTest> {
  const { first, goalId, second } = full;
  const id = full.id ?? crypto.randomUUID();

  await prisma.goal.update({
    data: {
      details: {
        answered: [...ANSWERED, "placement"],
        placementTest: {
          attempt: {
            id,
            length: "wholeCourse",
            lessonsSkipped: 0,
            part: atPart,
            partComplete: false,
            partPrepared: false,
            ...(preparationFailed && { partPreparationFailed: true }),
            partSkillIds: [atPart === 1 ? first : second],
            partStartedAt: new Date().toISOString(),
            parts: [[first], [second]],
            partsAtOpen: 2,
            skillIds: [first, second],
          },
          result: null,
        },
        subject: "algebra",
      },
    },
    where: { id: goalId },
  });

  return { ...full, id };
}

/** A learn goal whose full test has two parts of one topic each, open at part 1 with no questions. */
async function createTwoPartTest(userId: string, { preparationFailed = false } = {}) {
  const goal = await createLearnGoal(userId);

  const topics = await prisma.planItem.findMany({
    orderBy: { position: "asc" },
    select: { skillId: true },
    where: { plan: { goalId: goal.id }, skillId: { not: null } },
  });

  const [first, second] = topics.flatMap(({ skillId }) => skillId ?? []);

  if (!first || !second) {
    throw new Error("Expected a topic in each part");
  }

  await Promise.all([
    prisma.item.deleteMany({ where: { skillId: { in: [first, second] } } }),
    // Unknown topics close the ones that build on them.
    prisma.skillPrerequisite.deleteMany({ where: { skillId: second } }),
  ]);

  return placeFullTest({ first, goalId: goal.id, second }, { preparationFailed });
}

async function finishQuickTest(page: Page) {
  await page.getByRole("button", { exact: true, name: "Start" }).click();

  for (const number of [1, 2, 3, 4]) {
    // oxlint-disable-next-line no-await-in-loop -- Questions come one at a time.
    await atQuestion(page, number);
    // oxlint-disable-next-line no-await-in-loop -- Questions come one at a time.
    await answerRight(page);
  }

  await stopTest(page);
  await expect(page.getByRole("heading", { name: /^[1-9]\d* lessons? skipped$/u })).toBeVisible();
}

test.describe("Testing what you know from the plan", () => {
  test("a test skips lessons and Undo on the result restores them", async ({
    noProgressUser,
    userWithoutProgress: page,
  }, testInfo) => {
    const goal = await createLearnGoal(noProgressUser.id);

    await page.goto("/plan");
    await page.getByRole("link", { name: /Test what you know/u }).click();

    await expect(page.getByRole("heading", { name: "Skip what you already know" })).toBeVisible();

    await expect(page.getByText("Up to 12 questions", { exact: true })).toBeVisible();
    await finishQuickTest(page);
    expect(await skippedLessons(goal.id)).toBeGreaterThan(0);

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
    const full = await createTwoPartTest(noProgressUser.id);
    const firstQuestion = "What would you do first?";
    const secondQuestion = "What would you do next?";

    const [, item] = await Promise.all([
      itemFixture({ content: choiceItemContent(firstQuestion), skillId: full.first }),
      itemFixture({ content: choiceItemContent(secondQuestion), skillId: full.second }),
    ]);

    await page.goto("/placement-test");
    await expect(page.getByRole("heading", { name: firstQuestion })).toBeVisible();
    await placeFullTest(full, { atPart: 2 });
    await page.getByRole("link", { exact: true, name: "Leave" }).click();
    await expect(page).toHaveURL(/\/plan$/u);

    await holdActionAnswer(page, "/placement-test", {
      start: () => page.getByRole("link", { name: /Test what you know/u }).click(),
      whileHeld: async () => {
        // The question kept from the last visit stays on screen, but it can't be answered until
        // this visit has read where the test is.
        await expect(page.getByRole("heading", { name: firstQuestion })).toBeVisible();
        await expect(page.getByRole("button", { name: "I don't know yet" })).toBeDisabled();
      },
    });

    await expect(page.getByRole("heading", { name: secondQuestion })).toBeVisible();
    await page.getByRole("button", { name: "I don't know yet" }).click();

    await expect
      .poll(() => prisma.attempt.count({ where: { focusTestId: full.id, itemId: item.id } }))
      .toBe(1);
  });

  test("an answer to a question another device moved past opens where the test is now", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const full = await createTwoPartTest(noProgressUser.id);
    const firstQuestion = "What would you do first?";
    const secondQuestion = "What would you do next?";

    await Promise.all([
      itemFixture({ content: choiceItemContent(firstQuestion), skillId: full.first }),
      itemFixture({ content: choiceItemContent(secondQuestion), skillId: full.second }),
    ]);

    await page.goto("/placement-test");
    await expect(page.getByRole("heading", { name: firstQuestion })).toBeVisible();

    await placeFullTest(full, { atPart: 2 });
    await page.getByRole("button", { name: "I don't know yet" }).click();

    await expect(page.getByRole("heading", { name: secondQuestion })).toBeVisible();
    await expect(page.getByText("That didn't go through. Your answers are kept.")).toBeHidden();
  });

  test("a test whose questions couldn't be written opens once Try again works", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const full = await createTwoPartTest(noProgressUser.id, { preparationFailed: true });

    await page.goto("/placement-test");
    await expect(page.getByText("Something went wrong on our side")).toBeVisible();

    let refused = false;

    await page.route("**/placement-test", async (route) => {
      if (refused || route.request().method() !== "POST") {
        await route.fallback();
        return;
      }

      refused = true;
      await route.abort("connectionfailed");
    });

    const retry = page.getByRole("button", { exact: true, name: "Try again" });
    await retry.click();
    await expect.poll(() => refused).toBe(true);
    await expect(page.getByText("Something went wrong on our side")).toBeVisible();

    const question = "What would you do first?";
    await itemFixture({ content: choiceItemContent(question), skillId: full.first });
    await retry.click();

    await expect(page.getByRole("heading", { name: question })).toBeVisible();
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
      page.getByRole("link", { name: /Test what you know.*In progress.*Question 2 of 12/u }),
    ).toBeVisible();

    await page.goto("/placement-test");
    await expect(page.getByRole("button", { name: "I don't know yet" })).toBeVisible();
    await atQuestion(page, 2);

    await page.reload();
    await answerRight(page);
    await atQuestion(page, 3);
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
    await expect(page.getByRole("heading", { name: /lessons? skipped$/u })).toBeHidden();
  });
});

test("a test's skip appears on Plan and Today and can be undone from Today", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createLearnGoal(noProgressUser.id);

  await page.goto("/placement-test");
  await finishQuickTest(page);
  await page.getByRole("button", { exact: true, name: "Done" }).click();

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

test("onboarding's test ends on its result, which a reload keeps", async ({
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
  await expect(page.getByRole("heading", { name: "No lessons skipped" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "No lessons skipped" })).toBeVisible();
  await page.getByRole("button", { exact: true, name: "Continue" }).click();

  await expect(page.getByRole("button", { name: "Adjust plan" })).toBeVisible();
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
