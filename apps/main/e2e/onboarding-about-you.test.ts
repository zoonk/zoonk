import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectHydrated } from "@zoonk/e2e/hydration";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { expect, test } from "./fixtures";
import { mapGoalSkills } from "./onboarding-fixtures";

async function createGoalAtAboutYou(userId: string) {
  const goal = await goalFixture({
    dailyMinutes: 30,
    details: { answered: ["purpose", "targetDate", "level", "buddy"], level: "none" },
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
