import { randomUUID } from "node:crypto";
import { BIOGRAPHY_QUESTIONS } from "@zoonk/core/profile/questions/contract";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { expect, test } from "./fixtures";
import { mapGoalSkills } from "./onboarding-fixtures";

const BEFORE_ABOUT_YOU = ["purpose", "targetDate", "level", "buddy"];

const TIME_QUESTION = "How much time can you study each day?";

/** What Skip all left on the first goal, asked again on the next one, in order. */
const SKIPPED_ALL = [
  "What do you like to watch?",
  "What do you like to listen to?",
  "What do you like to play?",
  "What do you like to read?",
  "What do you like to do?",
  "Which apps and tools do you use most?",
  "Do any of these apply to you?",
  "What helps you learn?",
];

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

test("questions about the learner lead to the plan; a skipped one isn't asked again, and Skip all's come back on the next goal", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createGoalAtAboutYou(noProgressUser.id);
  await page.goto(`/start/${goal.id}`);

  await expect(page.getByRole("heading", { name: "What do you do now?" })).toBeVisible();

  const work = page.getByRole("radio", { exact: true, name: "I work" });
  await work.click();
  await page.getByLabel("Your job (optional)").fill("nurse");
  await page.getByRole("button", { name: "Continue" }).press("Enter");

  await expect(page.getByRole("heading", { name: "What have you studied?" })).toBeFocused();

  await page.getByRole("button", { exact: true, name: "Skip" }).click();
  await expect(page.getByRole("heading", { name: "What do you like to watch?" })).toBeVisible();

  await page.getByRole("button", { exact: true, name: "Skip all" }).click();

  await expect(page.getByRole("heading", { name: TIME_QUESTION })).toBeVisible();

  await page.getByRole("button", { exact: true, name: "Continue" }).click();
  await expect(page.getByRole("button", { name: "Adjust plan" })).toBeVisible();

  const [answers, facts] = await Promise.all([
    prisma.profileAnswer.findMany({ where: { userId: noProgressUser.id } }),
    prisma.memoryFact.findMany({ where: { status: "active", userId: noProgressUser.id } }),
  ]);

  expect(answers.map(({ outcome, question }) => ({ outcome, question }))).toStrictEqual([
    { outcome: "answered", question: "work" },
    { outcome: "declined", question: "studies" },
  ]);

  expect(facts.map((fact) => fact.statement)).toStrictEqual(["Works as: nurse"]);

  const next = await createGoalAtAboutYou(noProgressUser.id);
  await page.goto(`/start/${next.id}`);

  for (const question of SKIPPED_ALL) {
    // oxlint-disable-next-line no-await-in-loop -- Each question must show before it's skipped.
    await expect(page.getByRole("heading", { name: question })).toBeVisible();
    // oxlint-disable-next-line no-await-in-loop -- One skip, then the next question.
    await page.getByRole("button", { exact: true, name: "Skip" }).click();
  }

  await expect(page.getByRole("heading", { name: TIME_QUESTION })).toBeVisible();
});

test("the tools question comes last with the learner's own list, takes any number of chips, and saves typed tools, the one left in the field too", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  await learningProfileFixture({
    suggestedTools: ["Tasy", "MV Soul", "UpToDate", "Whitebook", "Excel"],
    userId: noProgressUser.id,
  });

  const goal = await createGoalAtAboutYou(noProgressUser.id, [
    ...BEFORE_ABOUT_YOU,
    ...BIOGRAPHY_QUESTIONS.filter((question) => question !== "tools"),
  ]);

  await page.goto(`/start/${goal.id}`);

  const title = page.getByRole("heading", { name: "Which apps and tools do you use most?" });
  const tasy = page.getByRole("button", { exact: true, name: "Tasy" });
  await expect(title).toBeVisible();
  await expect(page.getByText("Pick up to 3.")).toBeHidden();

  for (const name of ["Tasy", "MV Soul", "UpToDate", "Whitebook"]) {
    const chip = page.getByRole("button", { exact: true, name });
    // oxlint-disable-next-line no-await-in-loop -- One tap after another, as a learner taps.
    await chip.click();
    // oxlint-disable-next-line no-await-in-loop -- Each tap shows before the next.
    await expect(chip).toHaveAttribute("aria-pressed", "true");
  }

  const field = page.getByLabel("Others (optional)");

  const typed = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: /^Remove /u }) });

  const add = page.getByRole("button", { exact: true, name: "Add" });
  await expect(add).toBeDisabled();

  await field.fill("ClinicalKey");
  await expect(add).toBeEnabled();
  await add.click();
  await field.fill("Medscape");
  await field.press("Enter");

  await expect(title).toBeVisible();
  await expect(field).toHaveValue("");
  await expect(typed).toHaveText(["ClinicalKey", "Medscape"]);

  await page.getByRole("button", { name: "Remove ClinicalKey" }).click();
  await expect(typed).toHaveText(["Medscape"]);
  await expect(field).toBeFocused();

  await field.pressSequentially("tasy,");
  await expect(typed).toHaveText(["Medscape"]);
  await expect(tasy).toHaveAttribute("aria-pressed", "true");

  await field.fill("Epocrates");
  await page.getByRole("button", { exact: true, name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Do any of these apply to you?" })).toBeVisible();

  await expect
    .poll(async () => {
      const facts = await prisma.memoryFact.findMany({
        where: { status: "active", userId: noProgressUser.id },
      });

      return facts.map((fact) => fact.statement);
    })
    .toStrictEqual(["Uses MV Soul, Tasy, UpToDate, Whitebook, Medscape, and Epocrates"]);
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
