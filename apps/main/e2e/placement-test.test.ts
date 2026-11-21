import { prisma } from "@zoonk/db";
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
async function createLearnGoalOnPlan(userId: string) {
  const goal = await createMappedGoal(userId);

  await prisma.goal.update({
    data: {
      details: { answered: [...ANSWERED, "placement"], subject: "algebra" },
      planRevealedAt: new Date(),
    },
    where: { id: goal.id },
  });

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

test.describe("Testing what you know from the plan", () => {
  test("a quick test skips the topic the learner answered right and shows on the plan", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await createLearnGoalOnPlan(noProgressUser.id);

    await page.goto("/plan");
    await page.getByRole("link", { name: /Test what you know/u }).click();

    await expect(
      page.getByRole("heading", { name: "How much do you want to check?" }),
    ).toBeVisible();

    await expect(page.getByRole("radio", { name: /Quick/u })).toBeChecked();
    await page.getByRole("button", { exact: true, name: "Start" }).click();

    for (const _ of [1, 2, 3, 4]) {
      // oxlint-disable-next-line no-await-in-loop -- Questions come one at a time.
      await answerRight(page);
    }

    await page.getByRole("button", { name: "I don't know yet" }).click();
    await page.getByRole("button", { name: "Stop and use my answers" }).click();

    await expect(page.getByRole("heading", { name: /^\d+ lessons? skipped$/u })).toBeVisible();
    await expect(page.getByText("The whole-course test can skip more.")).toBeVisible();

    await page.getByRole("button", { exact: true, name: "Done" }).click();

    await expect(page.getByRole("link", { name: /Test what you know.*skipped/u })).toBeVisible();
  });

  test("a whole-course test picks up where the learner left and stops between parts", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await createLearnGoalOnPlan(noProgressUser.id);

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
