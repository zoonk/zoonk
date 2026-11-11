import { randomUUID } from "node:crypto";
import { BIOGRAPHY_QUESTIONS } from "@zoonk/core/profile/questions/contract";
import { prisma } from "@zoonk/db";
import { expectHydrated } from "@zoonk/e2e/hydration";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { expect, test } from "./fixtures";
import { mapGoalSkills } from "./onboarding-fixtures";

const BEFORE_ABOUT_YOU = ["purpose", "targetDate", "level", "buddy"];

async function createGoalAtAboutYou(userId: string, answered: string[] = BEFORE_ABOUT_YOU) {
  const goal = await goalFixture({
    dailyMinutes: 30,
    details: { answered, level: "none" },
    planRevealedAt: null,
    prompt: `learn algebra ${randomUUID()}`,
    title: "Learn algebra",
    userId,
  });

  await mapGoalSkills({ goalId: goal.id });
  return goal;
}

test("questions about the learner lead to the plan, and a skipped one comes back on the next goal", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createGoalAtAboutYou(noProgressUser.id);
  await page.goto(`/start/${goal.id}`);

  await expect(page.getByRole("heading", { name: "What do you do now?" })).toBeVisible();
  await expect(page.getByText("About you · 1 of 10")).toBeVisible();

  const work = page.getByRole("radio", { exact: true, name: "I work" });
  await expectHydrated(work);
  await work.click();
  await page.getByLabel("Your job (optional)").fill("nurse");
  await page.getByRole("button", { name: "Continue" }).press("Enter");

  await expect(
    page.getByRole("heading", { name: "Which apps and tools do you use most?" }),
  ).toBeFocused();

  await page.getByRole("button", { exact: true, name: "Skip" }).click();
  await expect(page.getByRole("heading", { name: "What have you studied?" })).toBeVisible();

  await page.getByRole("button", { exact: true, name: "Skip all" }).click();

  await expect(
    page.getByRole("heading", { name: "How much time can you study each day?" }),
  ).toBeVisible();

  await page.getByRole("button", { exact: true, name: "See your plan" }).click();
  await expect(page.getByText("Plan created", { exact: true })).toBeVisible();

  const [answers, facts] = await Promise.all([
    prisma.profileAnswer.findMany({ where: { userId: noProgressUser.id } }),
    prisma.memoryFact.findMany({ where: { status: "active", userId: noProgressUser.id } }),
  ]);

  expect(answers.map(({ outcome, question }) => ({ outcome, question }))).toStrictEqual([
    { outcome: "answered", question: "work" },
  ]);

  expect(facts.map((fact) => fact.statement)).toStrictEqual(["Works as: nurse"]);

  const next = await createGoalAtAboutYou(noProgressUser.id);
  await page.goto(`/start/${next.id}`);

  await expect(
    page.getByRole("heading", { name: "Which apps and tools do you use most?" }),
  ).toBeVisible();

  await expect(page.getByText("About you · 1 of 9")).toBeVisible();
});

function createGoalAtConditions(userId: string) {
  return createGoalAtAboutYou(userId, [...BEFORE_ABOUT_YOU, ...BIOGRAPHY_QUESTIONS]);
}

test("picked conditions are saved with Something else's words, and the next screen checks what helps", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createGoalAtConditions(noProgressUser.id);
  await page.goto(`/start/${goal.id}`);

  await expect(page.getByRole("heading", { name: "Do any of these apply to you?" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "I'd rather not say" })).toBeHidden();

  const adhd = page.getByRole("checkbox", { name: "ADHD" });
  await expectHydrated(adhd);
  await adhd.click();
  await page.getByRole("checkbox", { name: /^Something else/u }).click();

  const note = page.getByLabel("What should we know?");
  const next = page.getByRole("button", { name: "Continue" });
  await expect(note).toBeFocused();
  await expect(next).toBeDisabled();

  await note.fill("Migraines");
  await next.click();

  await expect(page.getByRole("heading", { name: "What helps you learn?" })).toBeVisible();

  await expect(page.getByRole("checkbox", { name: /^Step by step/u })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /^Short answers/u })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /^Shorter study days/u })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /^Examples first/u })).not.toBeChecked();

  const conditions = await prisma.learnerCondition.findMany({
    orderBy: { condition: "asc" },
    where: { userId: noProgressUser.id },
  });

  expect(conditions.map(({ condition, note: text }) => ({ condition, text }))).toStrictEqual([
    { condition: "adhd", text: null },
    { condition: "other", text: "Migraines" },
  ]);
});

test("skipping conditions declines them, so the next goal doesn't ask again", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createGoalAtConditions(noProgressUser.id);
  await page.goto(`/start/${goal.id}`);

  const skip = page.getByRole("button", { exact: true, name: "Skip" });
  await expectHydrated(skip);
  await skip.click();

  await expect(page.getByRole("heading", { name: "What helps you learn?" })).toBeVisible();

  await expect
    .poll(() =>
      prisma.profileAnswer.findMany({
        select: { outcome: true },
        where: { question: "conditions", userId: noProgressUser.id },
      }),
    )
    .toStrictEqual([{ outcome: "declined" }]);

  const next = await createGoalAtConditions(noProgressUser.id);
  await page.goto(`/start/${next.id}`);

  await expect(page.getByRole("heading", { name: "What helps you learn?" })).toBeVisible();
});
