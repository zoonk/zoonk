import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { itemFixture } from "@zoonk/testing/fixtures/skills";
import { type Page, expect, test } from "./fixtures";
import { ANSWERED, createMappedGoal } from "./onboarding-fixtures";

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

const confirm = (page: Page) => page.getByRole("button", { exact: true, name: "Confirm" }).click();

/** The quick question asks "Solve x + a = b": its right answer is b - a. */
async function answerRight(page: Page) {
  const title = page.getByRole("heading", { level: 1, name: /Solve x \+|Put the/u });
  const text = await title.innerText();
  const solve = /x \+ (?<add>\d+) = (?<sum>\d+)/u.exec(text)?.groups;

  if (solve) {
    await page.getByRole("radio", { name: String(Number(solve.sum) - Number(solve.add)) }).click();
  } else {
    for (const step of STEPS) {
      // oxlint-disable-next-line no-await-in-loop -- Each step is placed after the one before it.
      await page.getByRole("checkbox", { name: step }).click();
    }
  }

  await confirm(page);
  await expect(title.filter({ hasText: text })).toBeHidden();
}

const skippedLessons = (goalId: string) =>
  prisma.planItem.count({ where: { plan: { goalId }, status: "testedOut" } });

async function finishQuickTest(page: Page) {
  await page.getByRole("button", { exact: true, name: "Start" }).click();

  for (const _ of [1, 2, 3, 4]) {
    // oxlint-disable-next-line no-await-in-loop -- Questions come one at a time.
    await answerRight(page);
  }

  await page.getByRole("button", { name: "Stop and use my answers" }).click();
  await expect(page.getByRole("heading", { name: /^[1-9]\d* lessons? skipped$/u })).toBeVisible();
}

test.describe("Testing what you know from the plan", () => {
  test("a quick test skips lessons and Undo on the result restores them", async ({
    noProgressUser,
    userWithoutProgress: page,
  }, testInfo) => {
    const goal = await createLearnGoal(noProgressUser.id);

    await page.goto("/plan");
    await page.getByRole("link", { name: /Test what you know/u }).click();

    await expect(
      page.getByRole("heading", { name: "How much do you want to check?" }),
    ).toBeVisible();

    await expect(page.getByRole("radio", { name: /Quick/u })).toBeChecked();
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
    await page.getByRole("radio", { name: /Whole course/u }).click();
    await page.getByRole("button", { exact: true, name: "Start" }).click();

    await expect(
      page.getByText("Writing your questions", { exact: true }).filter({ visible: true }),
    ).toBeVisible();

    await expect(page.getByText("Reading your goal", { exact: true })).toBeHidden();
    await expect(page.getByText("Choosing what to learn", { exact: true })).toBeHidden();
    await page.screenshot({ path: testInfo.outputPath("placement-plan-wait.png") });
  });

  test("offers no B2 test-out while B2 has no lessons it could skip", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const { goal } = await languageGoalFixture({ userId: noProgressUser.id });

    await prisma.goal.update({
      data: {
        details: { answered: [...ANSWERED, "placement"], level: "B1" },
        planRevealedAt: new Date(),
      },
      where: { id: goal.id },
    });

    await page.goto("/level-test");

    await expect(
      page.getByRole("heading", { name: "How much do you want to check?" }),
    ).toBeVisible();

    await expect(page.getByRole("radio", { name: /Quick/u })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Test out of B2/u })).toBeHidden();
  });

  test("a whole-course test picks up where the learner left and stops between parts", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await createLearnGoal(noProgressUser.id);

    await page.goto("/placement-test");
    await page.getByRole("radio", { name: /Whole course/u }).click();
    await page.getByRole("button", { exact: true, name: "Start" }).click();

    await expect(page.getByText("Part 1", { exact: true })).toBeVisible();
    await answerRight(page);

    await page.goto("/plan");

    await expect(
      page.getByRole("link", { name: /Test what you know.*In progress/u }),
    ).toBeVisible();

    await page.goto("/placement-test");
    await expect(page.getByRole("button", { name: "I don't know yet" })).toBeVisible();

    await page.reload();
    await answerRight(page);

    await page.getByRole("button", { name: "Stop and use my answers" }).click();
    await expect(page.getByText(/Your answers are saved\./u)).toBeVisible();

    await page.getByRole("button", { exact: true, name: "Finish for today" }).click();

    await expect(
      page.getByRole("link", { name: /Test what you know.*In progress/u }),
    ).toBeVisible();

    await page.goto("/placement-test");
    await expect(page.getByRole("heading", { name: "Continue your test" })).toBeVisible();
    await page.getByRole("button", { exact: true, name: "Keep going" }).click();
    await expect(page.getByText("Part 2", { exact: true })).toBeVisible();
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

test("onboarding finishes after part one and the whole course continues from Plan", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createLearnGoal(noProgressUser.id, { onboarding: true });

  await page.goto(`/start/${goal.id}`);
  await expect(page.getByRole("radio", { name: /Quick/u })).toBeChecked();
  await page.getByRole("radio", { name: /Whole course/u }).click();
  await page.getByRole("button", { exact: true, name: "Start" }).click();
  await expect(page.getByText("Part 1", { exact: true })).toBeVisible();
  await answerRight(page);

  await page.getByRole("button", { name: "Stop and use my answers" }).click();
  await expect(page.getByText("You can finish the test from Plan.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Keep going" })).toBeHidden();

  await page.reload();
  await expect(page.getByText("You can finish the test from Plan.")).toBeVisible();
  await page.getByRole("button", { exact: true, name: "Continue" }).click();

  await expect(page.getByRole("button", { name: "Adjust plan" })).toBeVisible();
  await page.getByRole("button", { exact: true, name: "Start" }).click();
  await expect(page).toHaveURL(/\/today$/u);
  await page.goto("/plan");

  await expect(page.getByRole("link", { name: /Test what you know.*In progress/u })).toBeVisible();
  await page.getByRole("link", { name: /Test what you know.*In progress/u }).click();
  await page.getByRole("button", { name: "Keep going" }).click();
  await expect(page.getByText("Part 2", { exact: true })).toBeVisible();
});
