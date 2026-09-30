import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import {
  goalFixture,
  planFixture,
  planItemFixture,
  suggestedGoalFixture,
} from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { memoryInsightFixture } from "@zoonk/testing/fixtures/memory";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { expect, test } from "./fixtures";
import { type StreamEvent, followRun } from "./generation-run";
import { pressShortcutAndWaitForUrl } from "./keyboard-shortcuts";
import { MODES, type Mode, asPersona } from "./learn-personas";
import {
  DAYS_TO_EXAM,
  LESSON_CAN_DO,
  LESSON_TITLE,
  createStudyDay,
  openAs,
  writeStudyLesson,
} from "./study-day";

test.describe("Today in Focus", () => {
  test("shows the countdown, the status line and the session with one Start", async ({
    browser,
  }) => {
    const { user } = await createStudyDay({ mode: "focus" });
    const page = await openAs(browser, user);
    await page.goto("/today");

    await expect(
      page.getByRole("heading", { level: 1, name: `${DAYS_TO_EXAM} days left` }),
    ).toBeVisible();

    const card = page.getByRole("region", { name: "Today's session" });
    await expect(card.getByText("Quick review")).toBeVisible();
    await expect(card.getByText(LESSON_TITLE)).toBeVisible();
    await expect(card.getByText(LESSON_CAN_DO)).toBeVisible();
    await expect(card.getByText("Mixed practice")).toBeVisible();
    await expect(card.getByText("0 of 7 min")).toBeVisible();
    await expect(card.getByRole("button", { name: /^Start/u })).toBeVisible();

    await expect(page.getByRole("region", { name: "This week" })).toBeVisible();
    await page.context().close();
  });

  test("welcomes a learner back kindly, with a lighter day", async ({ browser }) => {
    const { user } = await createStudyDay({ freshStart: "welcomeBack", mode: "focus" });
    const page = await openAs(browser, user);
    await page.goto("/today");

    await expect(
      page.getByText("Welcome back! Today is a lighter session, so it's easy to pick up again."),
    ).toBeVisible();

    await page.context().close();
  });

  test("answers the insight from recent sessions", async ({ browser }) => {
    const { goal, user } = await createStudyDay({ mode: "focus" });
    const insight = await memoryInsightFixture({ goalId: goal.id, userId: user.id });
    const page = await openAs(browser, user);
    await page.goto("/today");

    const card = page.getByRole("complementary", { name: "From your recent answers" });
    await expect(card.getByText(insight.message ?? "")).toBeVisible();
    await card.getByRole("button", { name: "Got it" }).click();
    await expect(card.getByText("Noted.")).toBeVisible();

    await expect
      .poll(async () => {
        const row = await prisma.memoryInsight.findUnique({ where: { id: insight.id } });
        return row?.status;
      })
      .toBe("accepted");

    await page.context().close();
  });

  test("offers a course from before goals below the day, until it's answered", async ({
    browser,
  }) => {
    const { user } = await createStudyDay({ mode: "focus" });
    const suggestion = await suggestedGoalFixture({ title: "Spanish", userId: user.id });
    const page = await openAs(browser, user);
    await page.goto("/today");

    const card = page.getByRole("complementary", { name: "Suggested goal" });
    await expect(card.getByText("Continue Spanish?")).toBeVisible();
    await expect(card.getByText("Build a plan in 1 minute.")).toBeVisible();
    await card.getByRole("button", { name: "Not now" }).click();

    await expect(card).toBeHidden();
    await expect(page.getByRole("region", { name: "Today's session" })).toBeVisible();

    await expect
      .poll(async () => {
        const row = await prisma.suggestedGoal.findUnique({ where: { id: suggestion.id } });
        return row?.status;
      })
      .toBe("dismissed");

    await page.reload();
    await expect(page.getByRole("region", { name: "Today's session" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Suggested goal" })).toBeHidden();
    await page.context().close();
  });

  test("Enter starts the day from the keyboard", async ({ browser }) => {
    const { user } = await createStudyDay({ mode: "focus" });
    const page = await openAs(browser, user);
    await page.goto("/today");

    await expect(page.getByRole("button", { name: /^Start/u })).toBeVisible();
    await pressShortcutAndWaitForUrl({ expectedUrl: /\/session$/u, key: "Enter", page });

    await expect(page.getByText(/^Capsule one/u)).toBeVisible();
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
const WRITTEN_WITHIN_MS = 15_000;

/** Today's lesson is being written right now, by a run the page doesn't follow. */
async function createDayWithLessonBeingWritten(mode: Mode) {
  const day = await createStudyDay({ mode, writtenLesson: false });

  await prisma.lesson.update({
    data: { contentRunId: `wrun_${randomUUID()}`, contentStatus: "running" },
    where: { id: day.lesson.id },
  });

  return day;
}

test.describe("Today while a lesson is being written", () => {
  test("Focus says so and shows the lesson on its own once it's written", async ({ browser }) => {
    const { lesson, user } = await createDayWithLessonBeingWritten("focus");
    const page = await openAs(browser, user);
    await page.goto("/today");

    const card = page.getByRole("region", { name: "Today's session" });
    const lessonRow = card.getByRole("listitem").filter({ hasText: LESSON_TITLE });
    await expect(lessonRow.getByText("Being written for you…")).toBeVisible();

    await writeStudyLesson(lesson.id);

    // No refresh: the row turns into the lesson's can-do line.
    await expect(lessonRow.getByText(LESSON_CAN_DO)).toBeVisible({ timeout: WRITTEN_WITHIN_MS });
    await expect(lessonRow.getByText("Being written for you…")).toBeHidden();
    await page.context().close();
  });

  test("Fun says so on its tile and shows its minutes on its own once it's written", async ({
    browser,
  }) => {
    const { lesson, user } = await createDayWithLessonBeingWritten("fun");
    const page = await openAs(browser, user);
    await page.goto("/today");

    const stops = page.getByRole("list", { name: "Other stops" });
    const tile = stops.getByRole("listitem").filter({ hasText: LESSON_TITLE });
    await expect(tile.getByText("Being written…", { exact: true })).toBeVisible();

    await writeStudyLesson(lesson.id);

    await expect(tile.getByText("3 min", { exact: true })).toBeVisible({
      timeout: WRITTEN_WITHIN_MS,
    });

    await expect(tile.getByText("Being written…", { exact: true })).toBeHidden();
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

  for (const mode of MODES) {
    test(`shows a designed wait while the plan is built (${mode})`, async ({ browser }) => {
      const user = await createE2EUser(getBaseURL());

      const goal = await goalFixture({
        timezone: "UTC",
        title: "Quantum physics",
        userId: user.id,
      });

      await Promise.all([
        planFixture({ goalId: goal.id }),
        learningProfileFixture({
          activeGoalId: goal.id,
          experienceMode: mode,
          userId: user.id,
          ...(mode === "fun" ? { buddyKind: "zu" } : {}),
        }),
      ]);

      const page = await openAs(browser, user);
      await page.goto("/today");

      await expect(
        page.getByRole("heading", { name: "Building your plan for Quantum physics" }),
      ).toBeVisible();

      await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);
      await page.context().close();
    });
  }

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

test.describe("Today for the seeded learners", () => {
  test("the exam learner continues today's lesson in Focus", async ({ browser }) => {
    await asPersona(browser, { mode: "focus", persona: "exam" }, async ({ page }) => {
      await page.goto("/today");

      const card = page.getByRole("region", { name: "Today's session" });
      await expect(card.getByRole("button", { name: /^Continue/u })).toBeVisible();
      await card.getByRole("button", { name: /^Continue/u }).click();

      await expect(page).toHaveURL(/\/learn\/[\w-]+\?session=[\w-]+$/u);
    });
  });

  test("the Fun learner keeps flying from the flight plan", async ({ browser }) => {
    await asPersona(browser, { mode: "fun", persona: "fun" }, async ({ page }) => {
      await page.goto("/today");

      await expect(page.getByRole("heading", { name: "Flight plan" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Missions" })).toBeVisible();
    });
  });

  // A phase ends with a phase checkpoint, so the week's challenge is the one this Sunday.
  for (const mode of MODES) {
    test(`the huge learn goal's weekly challenge is this Sunday's in ${mode}`, async ({
      browser,
    }) => {
      await asPersona(browser, { mode, persona: "hugeGoal" }, async ({ page }) => {
        await page.goto("/today");

        await expect(
          page.getByText(mode === "fun" ? "Sunday: Big Challenge" : "Sunday: weekly challenge", {
            exact: true,
          }),
        ).toBeVisible();
      });
    });
  }
});
