import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { warmUpFixture } from "@zoonk/testing/fixtures/warm-ups";
import { type Page, expect, test } from "./fixtures";
import { followRun } from "./generation-run";
import { mapGoalSkills } from "./onboarding-fixtures";

/** The time question asks the plan every 3 s while it's being built. */
const NEXT_CHECK_TIMEOUT_MS = 10_000;

const TIME_QUESTION = "How much time can you study each day?";

const DAILY_MINUTES = Array.from({ length: 7 }, () => 20);

/** A goal at the time question while its plan is built, by a run that already reported its deck. */
async function openPlanWait({ page, userId }: { page: Page; userId: string }) {
  const runId = `e2e-warm-up-${randomUUID()}`;

  const [deck, goal] = await Promise.all([
    warmUpFixture(),
    goalFixture({
      details: { answered: ["purpose", "targetDate", "level", "buddy", "placement"] },
      generationRunId: runId,
      prompt: `learn beekeeping ${randomUUID()}`,
      title: "Learn beekeeping",
      userId,
    }),
  ]);

  // As creating the goal does: an empty plan its build replaces.
  await prisma.plan.create({
    data: {
      goalId: goal.id,
      settings: { startDate: new Date().toISOString().slice(0, 10), weekdayMinutes: DAILY_MINUTES },
    },
  });

  await followRun({
    events: [
      { entityId: goal.id, status: "started", step: "understandGoal" },
      { status: "completed", step: "warmUpReady", warmUpId: deck.id },
      { entityId: goal.id, status: "started", step: "buildSkillGraph" },
    ],
    page,
    runId,
  });

  await page.goto(`/start/${goal.id}`);
  await expect(page.getByRole("heading", { name: "Building your plan" })).toBeVisible();

  return { deck, goal };
}

/** The goal's first lesson, being written by a run that never finishes here. */
async function addFirstLessonBeingWritten({ goalId, page }: { goalId: string; page: Page }) {
  const runId = `e2e-warm-up-lesson-${randomUUID()}`;

  const [lesson, plan] = await Promise.all([
    libraryLessonFixture({ contentRunId: runId, contentStatus: "running" }),
    prisma.plan.findUniqueOrThrow({ where: { goalId } }),
  ]);

  await planItemFixture({ lessonId: lesson.id, planId: plan.id });

  await followRun({
    events: [{ entityId: lesson.id, status: "started", step: "planLesson" }],
    page,
    runId,
  });

  return lesson;
}

test("a learner who guessed stays once the plan is ready, and the first lesson's wait deals the next card", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const { deck, goal } = await openPlanWait({ page, userId: noProgressUser.id });

  const card = page.getByRole("radiogroup", {
    name: "Why do beekeepers puff smoke into a hive before opening it?",
  });

  await card.getByRole("radio", { name: /alarm scent/u }).click();
  await expect(page.getByText("Good guess!")).toBeVisible();

  await mapGoalSkills({ goalId: goal.id });

  await expect(page.getByRole("heading", { name: "Your plan is ready" })).toBeVisible({
    timeout: NEXT_CHECK_TIMEOUT_MS,
  });

  await expect(page.getByRole("button", { name: "Next guess" })).toBeHidden();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: TIME_QUESTION })).toBeVisible();

  await prisma.goal.update({ data: { warmUpId: deck.id }, where: { id: goal.id } });
  const lesson = await addFirstLessonBeingWritten({ goalId: goal.id, page });
  await page.goto(`/learn/${lesson.id}`);

  await expect(
    page.getByRole("radiogroup", { name: "How many eyes does a honey bee have?" }),
  ).toBeVisible();
});

test("a learner who didn't guess moves on to the time question as soon as the plan is ready", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const { goal } = await openPlanWait({ page, userId: noProgressUser.id });

  await expect(
    page.getByRole("radiogroup", {
      name: "Why do beekeepers puff smoke into a hive before opening it?",
    }),
  ).toBeVisible();

  await mapGoalSkills({ goalId: goal.id });

  await expect(page.getByRole("heading", { name: TIME_QUESTION })).toBeVisible({
    timeout: NEXT_CHECK_TIMEOUT_MS,
  });
});
