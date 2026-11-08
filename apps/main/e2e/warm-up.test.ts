import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { warmUpFixture } from "@zoonk/testing/fixtures/warm-ups";
import { type Page, expect, test } from "./fixtures";
import { type StreamEvent, followRun } from "./generation-run";
import { ANSWERED, createMappedGoal, mapGoalSkills } from "./onboarding-fixtures";
import { createStudyDay, openAs, writeStudyLesson } from "./study-day";

/** The time question asks the plan every 3 s while it's being built. */
const NEXT_CHECK_TIMEOUT_MS = 10_000;

const TIME_QUESTION = "How much time can you study each day?";

const FIRST_CARD = "Why do beekeepers puff smoke into a hive before opening it?";

const STILL_READING_MS = 30 * 60_000;

const DAILY_MINUTES = Array.from({ length: 7 }, () => 20);

const PLAY_QUIZ = "Play a quiz while you wait";

/**
 * A goal at the time question while its plan is built, by a run that already reported its deck. A
 * page opened on the wait reads the deck after it draws, so the quiz is offered, not shown.
 */
async function openPlanWait({
  events = [],
  openingLessonId = null,
  page,
  userId,
}: {
  events?: StreamEvent[];
  openingLessonId?: string | null;
  page: Page;
  userId: string;
}) {
  const runId = `e2e-warm-up-${randomUUID()}`;

  const [deck, goal] = await Promise.all([
    warmUpFixture(),
    goalFixture({
      details: { answered: ["purpose", "targetDate", "level", "buddy", "placement"] },
      generationRunId: runId,
      openingLessonId,
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
      ...events,
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
  await page.getByRole("button", { name: PLAY_QUIZ }).click();

  const card = page.getByRole("radiogroup", { name: FIRST_CARD });

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
  await expect(page.getByRole("button", { name: PLAY_QUIZ })).toBeVisible();

  await mapGoalSkills({ goalId: goal.id });

  await expect(page.getByRole("heading", { name: TIME_QUESTION })).toBeVisible({
    timeout: NEXT_CHECK_TIMEOUT_MS,
  });
});

test("a learner who guessed on the session's first lesson wait keeps its finished timeline once the lesson is written", async ({
  browser,
}) => {
  const [{ goal, lesson, user }, deck] = await Promise.all([
    createStudyDay({ reviewDone: true, writtenLesson: false }),
    warmUpFixture(),
  ]);

  const runId = `e2e-warm-up-session-${randomUUID()}`;

  const events: StreamEvent[] = [
    { entityId: lesson.id, status: "started", step: "planLesson" },
    { entityId: lesson.id, status: "completed", step: "planLesson" },
    { entityId: lesson.id, status: "started", step: "writeLesson" },
  ];

  await Promise.all([
    prisma.goal.update({ data: { warmUpId: deck.id }, where: { id: goal.id } }),
    prisma.lesson.update({
      data: { contentRunId: runId, contentStatus: "running" },
      where: { id: lesson.id },
    }),
  ]);

  const page = await openAs(browser, user);
  await followRun({ events, page, runId });
  await page.goto("/session");

  const card = page.getByRole("radiogroup", { name: FIRST_CARD });
  await card.getByRole("radio", { name: /alarm scent/u }).click();
  await expect(page.getByText("Good guess!")).toBeVisible();

  const steps = page.getByRole("list", { name: "Writing your lesson" }).getByRole("listitem");
  await page.getByRole("button", { name: /^Writing your lesson/u }).click();

  await expect(steps).toHaveText([
    /^Planning the lesson, done/u,
    /^Writing the lesson, in progress/u,
    /^Highlighting the key ideas, not started yet/u,
    /^Drawing the pictures, not started yet/u,
  ]);

  await page.goBack();
  await expect(page.getByText("Good guess!")).toBeVisible();

  await writeStudyLesson(lesson.id);
  events.push({ entityId: lesson.id, status: "completed", step: "lessonReady" });

  await expect(page.getByRole("status").filter({ hasText: "Your lesson is ready." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next guess" })).toBeHidden();
  await expect(page.getByText(/^Smoke masks the alarm scent/u)).toBeVisible();

  await page.getByRole("button", { name: /^Your lesson is ready/u }).click();

  await expect(steps).toHaveText([
    /^Planning the lesson, done/u,
    /^Writing the lesson, done/u,
    /^Highlighting the key ideas, done/u,
    /^Drawing the pictures, done/u,
  ]);

  await page.getByRole("main").getByRole("button", { exact: true, name: "Start" }).click();
  await expect(page).toHaveURL(new RegExp(`/learn/${lesson.id}\\?session=`, "u"));
  await page.context().close();
});

test("a learner who guessed while the exam's notice is read stays once it's read", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const [deck, goal] = await Promise.all([warmUpFixture(), createMappedGoal(noProgressUser.id)]);

  await Promise.all([
    prisma.goal.update({
      data: {
        details: { answered: [...ANSWERED, "placement"], subject: "algebra" },
        generationRunId: goal.id,
      },
      where: { id: goal.id },
    }),
    prisma.plan.update({
      data: { noticeWaitUntil: new Date(Date.now() + STILL_READING_MS) },
      where: { goalId: goal.id },
    }),
  ]);

  await followRun({
    events: [
      { status: "completed", step: "warmUpReady", warmUpId: deck.id },
      { status: "completed", step: "createPlan" },
    ],
    page,
    runId: goal.id,
  });

  await page.goto(`/start/${goal.id}`);

  await expect(
    page.getByRole("heading", { name: "Reading the exam's official documents" }),
  ).toBeVisible();

  await page.getByRole("button", { name: PLAY_QUIZ }).click();
  const card = page.getByRole("radiogroup", { name: FIRST_CARD });
  await card.getByRole("radio", { name: /alarm scent/u }).click();
  await expect(page.getByText("Good guess!")).toBeVisible();

  await prisma.plan.update({ data: { noticeWaitUntil: null }, where: { goalId: goal.id } });

  await expect(page.getByRole("heading", { name: "Your plan is ready" })).toBeVisible({
    timeout: NEXT_CHECK_TIMEOUT_MS,
  });

  await expect(page.getByRole("button", { name: "Next guess" })).toBeHidden();
  await page.getByRole("button", { name: "See your plan" }).click();
  await expect(page.getByText("Plan created", { exact: true })).toBeVisible();
});

test("a learner whose first lesson is written before the plan starts it from the wait", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const lesson = await libraryLessonFixture({
    contentStatus: "completed",
    title: "Why birds sing at dawn",
  });

  await openPlanWait({
    events: [
      {
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        status: "started",
        step: "writeFirstLesson",
      },
      { lessonId: lesson.id, status: "completed", step: "firstLessonReady" },
    ],
    openingLessonId: lesson.id,
    page,
    userId: noProgressUser.id,
  });

  await expect(page.getByText("Your plan will be waiting when you finish.")).toBeVisible();
  await page.getByRole("link", { name: "Start lesson 1" }).click();
  await expect(page).toHaveURL(new RegExp(`/learn/${lesson.id}`, "u"));
});
