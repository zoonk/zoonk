import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import {
  goalFixture,
  planFixture,
  planItemFixture,
  suggestedGoalFixture,
} from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { expect, test } from "./fixtures";
import { type StreamEvent, followRun } from "./generation-run";
import {
  DAYS_TO_EXAM,
  LESSON_CAN_DO,
  LESSON_TITLE,
  createStudyDay,
  openAs,
  writeStudyLesson,
} from "./study-day";

test.describe("Today in Focus", () => {
  test("shows the countdown, the session with one Start, a kind welcome back and a course from before goals", async ({
    browser,
  }) => {
    const { user } = await createStudyDay({ freshStart: "welcomeBack", mode: "focus" });
    await suggestedGoalFixture({ title: "Spanish", userId: user.id });
    const page = await openAs(browser, user);
    await page.goto("/today");

    await expect(
      page.getByRole("heading", { level: 1, name: `${DAYS_TO_EXAM} days left` }),
    ).toBeVisible();

    await expect(
      page.getByText("Welcome back! Today is a lighter session, so it's easy to pick up again."),
    ).toBeVisible();

    const card = page.getByRole("region", { name: "Today's session" });
    await expect(card.getByText("Quick review")).toBeVisible();
    await expect(card.getByText(LESSON_TITLE)).toBeVisible();
    await expect(card.getByText(LESSON_CAN_DO)).toBeVisible();
    await expect(card.getByText("Mixed practice")).toBeVisible();
    await expect(card.getByText("0 of 7 min")).toBeVisible();
    await expect(card.getByRole("button", { name: /^Start/u })).toBeVisible();

    await expect(page.getByRole("region", { name: "This week" })).toBeVisible();

    // A free exam plan in its first week has no paywall.
    await expect(
      page.getByRole("complementary", { name: "Exam prep on the free plan" }),
    ).toHaveCount(0);

    // None of the learner's sources changed, so no notice says what did.
    await expect(page.getByRole("complementary", { name: "What changed" })).toHaveCount(0);

    // A course from before goals waits below the day until it's answered.
    const suggestion = page.getByRole("complementary", { name: "Suggested goal" });
    await expect(suggestion.getByText("Continue Spanish?")).toBeVisible();
    await expect(suggestion.getByText("Build a plan in 1 minute.")).toBeVisible();
    await expectAccessibleScreen(page, "Today");

    await suggestion.getByRole("button", { name: "Not now" }).click();
    await expect(suggestion).toBeHidden();
    await expect(card).toBeVisible();

    await page.context().close();
  });
});

test.describe("Today in Fun", () => {
  test("shows the destination, the flight plan and one Take off", async ({ browser }) => {
    const { goal, user } = await createStudyDay({ mode: "fun" });
    const page = await openAs(browser, user);
    await page.goto("/today");

    await expect(page.getByText(`Destination · ${goal.title}`)).toBeVisible();

    await expect(
      page.getByRole("heading", { level: 1, name: `${DAYS_TO_EXAM} days` }),
    ).toBeVisible();

    await expect(page.getByRole("heading", { name: "Flight plan" })).toBeVisible();

    const next = page.getByRole("article", { name: "Next stop" });
    await expect(next.getByRole("heading", { name: "1 capsule to open" })).toBeVisible();
    await expect(next.getByText("Percentages")).toBeVisible();

    await expect(page.getByRole("button", { name: /^Take off/u })).toBeVisible();

    // A new learner sees the flight plan and the buddy first; missions come on the second day.
    await expect(page.getByRole("heading", { name: "Missions" })).toBeHidden();
    await expect(page.getByRole("img", { name: "Zu" }).first()).toBeVisible();
    await page.context().close();
  });

  test("reveals the missions and the full meal from the second study day", async ({ browser }) => {
    const { user } = await createStudyDay({ earlierStudyDay: true, mode: "fun" });
    const page = await openAs(browser, user);
    await page.goto("/today");

    const missions = page.getByRole("region", { name: "Missions" });
    await expect(missions.getByText("Open today's capsules")).toBeVisible();
    await expect(missions.getByText("Finish the new lesson")).toBeVisible();
    // Nothing to fix today still counts, so one of the three is already done.
    await expect(missions.getByText(/Zu has had 1 of 3/u)).toBeVisible();
    await page.context().close();
  });
});

/** Today reads itself again every 5 seconds while a stop is being written. */
const WRITING_REFRESH_MS = 5000;

test.describe("Today while a lesson is being written", () => {
  test("says so and shows the lesson on its own once it's written", async ({ browser }) => {
    const { lesson, user } = await createStudyDay({ mode: "focus", writtenLesson: false });

    // Being written right now, by a run the page doesn't follow.
    await prisma.lesson.update({
      data: { contentRunId: `wrun_${randomUUID()}`, contentStatus: "running" },
      where: { id: lesson.id },
    });

    const page = await openAs(browser, user);
    await page.clock.install();
    await page.goto("/today");

    const card = page.getByRole("region", { name: "Today's session" });
    const lessonRow = card.getByRole("listitem").filter({ hasText: LESSON_TITLE });
    await expect(lessonRow.getByText("Being written for you…")).toBeVisible();

    await writeStudyLesson(lesson.id);
    await page.clock.fastForward(WRITING_REFRESH_MS);

    // No refresh: the row turns into the lesson's can-do line at Today's next read.
    await expect(lessonRow.getByText(LESSON_CAN_DO)).toBeVisible();
    await expect(lessonRow.getByText("Being written for you…")).toBeHidden();
    await page.context().close();
  });
});

test.describe("Today without a day to show", () => {
  test("sends a learner without a goal to set one", async ({ userWithoutProgress }) => {
    await userWithoutProgress.goto("/today");
    await expect(userWithoutProgress).toHaveURL(/\/start$/u);
  });

  test("welcomes a returning learner back to their last course", async ({ browser }) => {
    const user = await createE2EUser(getBaseURL());
    const suggestion = await suggestedGoalFixture({ title: "Physics", userId: user.id });
    const page = await openAs(browser, user);
    await page.goto("/today");

    await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible();

    const card = page.getByRole("complementary", { name: "Suggested goal" });
    await expect(card.getByText("Continue Physics?")).toBeVisible();
    await card.getByRole("button", { name: "Build my plan" }).click();

    await expect(page).toHaveURL(/\/start\?goal=Physics$/u);
    await expect(page.getByRole("textbox", { name: "Your goal" })).toHaveValue("Physics");

    await expect
      .poll(async () => {
        const row = await prisma.suggestedGoal.findUnique({ where: { id: suggestion.id } });
        return row?.status;
      })
      .toBe("accepted");

    await page.context().close();
  });

  test("follows the plan being built and opens the day on its own", async ({ browser }) => {
    const user = await createE2EUser(getBaseURL());
    const runId = `e2e-today-${randomUUID()}`;

    const goal = await goalFixture({
      generationRunId: runId,
      timezone: "UTC",
      title: "Quantum physics",
      userId: user.id,
    });

    const [plan, played] = await Promise.all([
      planFixture({ goalId: goal.id }),
      playableLessonFixture(),
      learningProfileFixture({ activeGoalId: goal.id, experienceMode: "focus", userId: user.id }),
    ]);

    const events: StreamEvent[] = [
      { entityId: goal.id, status: "started", step: "understandGoal" },
      { entityId: goal.id, status: "started", step: "buildSkillGraph" },
    ];

    const page = await openAs(browser, user);
    await followRun({ events, page, runId });
    await page.goto("/today");

    await expect(
      page.getByRole("heading", { name: "Building your plan for Quantum physics" }),
    ).toBeVisible();

    await expect(
      page.getByRole("progressbar", { name: "Getting your first day ready" }),
    ).toBeVisible();

    const phases = page.getByRole("list", { name: "Getting your first day ready" });
    await expect(phases.getByRole("listitem").nth(0)).toHaveText("Reading your goal, done");

    await expect(phases.getByRole("listitem").nth(1)).toContainText(
      "Mapping the skills it takes, in progress",
    );

    // The run saves the plan: the stream says so and the day opens without a refresh.
    await planItemFixture({
      kind: "lesson",
      lessonId: played.lesson.id,
      planId: plan.id,
      titleSnapshot: "Waves and particles",
    });

    events.push(
      { entityId: goal.id, status: "completed", step: "buildSkillGraph" },
      { entityId: goal.id, status: "started", step: "saveSkills" },
      { entityId: goal.id, status: "completed", step: "createPlan" },
    );

    await expect(page.getByRole("region", { name: "Today's session" })).toBeVisible();
    await page.context().close();
  });

  test("says when building the plan failed and starts it again on a tap", async ({ browser }) => {
    const user = await createE2EUser(getBaseURL());
    const runId = `e2e-today-${randomUUID()}`;

    const goal = await goalFixture({
      generationRunId: runId,
      timezone: "UTC",
      title: "Quantum physics",
      userId: user.id,
    });

    await Promise.all([
      planFixture({ goalId: goal.id }),
      learningProfileFixture({ activeGoalId: goal.id, experienceMode: "focus", userId: user.id }),
    ]);

    const page = await openAs(browser, user);

    await followRun({
      events: [
        { entityId: goal.id, status: "started", step: "understandGoal" },
        { entityId: goal.id, reason: "aiGenerationFailed", status: "error", step: "workflowError" },
      ],
      page,
      runId,
    });

    await page.goto("/today");

    const failed = page.getByRole("alert").filter({ hasText: "This didn't finish" });
    await expect(failed).toBeVisible();
    await failed.getByRole("button", { name: "Try again" }).click();

    // The tap starts the run again: the wait follows it, or says the start failed with a way out.
    await expect(failed).toBeHidden();

    await expect(
      page
        .getByRole("progressbar", { name: "Getting your first day ready" })
        .or(page.getByRole("alert").filter({ hasText: "This didn't start" })),
    ).toBeVisible();

    await page.context().close();
  });
});
