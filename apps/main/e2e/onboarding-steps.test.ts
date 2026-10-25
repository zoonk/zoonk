import { randomUUID } from "node:crypto";
import { getTargetDateBounds } from "@zoonk/core/plans/target-date-range";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { type Page, expect, test } from "./fixtures";
import { followRun } from "./generation-run";
import { ANSWERED, mapGoalSkills } from "./onboarding-fixtures";

/**
 * The steps after a goal is created (`/start/[goalId]`): a refresh comes back to where the learner
 * was, every wait follows the goal's run and moves on by itself, and every way a wait can stop
 * (the run failed, never started, lost its connection, or placement has no questions) says so with
 * a way out. The run's stream is the API's, stood in for with `page.route`.
 */

/** A lost connection is retried with backoff (2 to 16 s) before the learner is told. */
const CONNECTION_GIVE_UP_MS = 60_000;
/** A run that doesn't appear within 45 s didn't start. */
const RUN_START_LIMIT_MS = 46_000;
/** A level test writer that went quiet this long ago no longer holds its claim (11 minutes). */
const STALE_WRITER_MS = 20 * 60 * 1000;

/** A goal whose run is still drawing its skill map: placement and the plan wait for it. */
async function createGoalBeingMapped({
  answered = ANSWERED,
  runId,
  userId,
}: {
  answered?: string[];
  runId: string | null;
  userId: string;
}) {
  return goalFixture({
    details: { answered, subject: "algebra" },
    generationRunId: runId,
    prompt: `learn algebra ${randomUUID()}`,
    title: "Learn algebra",
    userId,
  });
}

function placementWait(page: Page) {
  return page.getByRole("list", { name: "Getting your questions ready" }).getByRole("listitem");
}

test.describe("Refreshing mid-onboarding", () => {
  test("comes back to the same question, with the dots, Back and Start over, and Today leads back to the questions left", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await createGoalBeingMapped({
      answered: [],
      runId: null,
      userId: noProgressUser.id,
    });

    await page.goto(`/start/${goal.id}`);

    const purpose = "What do you want from it?";
    await expect(page.getByRole("heading", { name: purpose })).toBeVisible();
    await expectAccessibleScreen(page, purpose);

    await page.getByRole("radio", { name: /Understand it in depth/u }).click();
    await page.getByRole("button", { exact: true, name: "Continue" }).click();

    const date = page.getByRole("heading", { name: "Is there a date you're aiming for?" });
    await expect(date).toBeVisible();
    await expect(page.getByRole("img", { name: /^Step 2 of \d+$/u })).toBeVisible();
    await expectAccessibleScreen(page, "Is there a date you're aiming for?");

    await page.reload();

    await expect(date).toBeVisible();
    await expect(page.getByRole("img", { name: /^Step 2 of \d+$/u })).toBeVisible();

    // On a phone the questions have no tab bar: the bar has the way back, and its "More" the way
    // out, which keeps the answers, beside starting over. Today then leads back to the question.
    const size = page.viewportSize();
    await page.setViewportSize({ height: 844, width: 390 });
    await expect(page.getByRole("navigation", { name: "Learning tabs" })).toHaveCount(0);
    await page.getByRole("button", { name: "More" }).click();
    await expect(page.getByRole("menuitem", { name: /^Start over/u })).toBeVisible();
    await page.getByRole("menuitem", { name: /^Finish later/u }).click();

    await expect(
      page.getByText("Your plan for Learn algebra needs a few more answers."),
    ).toBeVisible();

    await page.getByRole("link", { name: "Continue setting up" }).click();
    await expect(date).toBeVisible();

    if (size) {
      await page.setViewportSize(size);
    }

    // The app's tabs stay in reach during the questions. Today, opened halfway, doesn't claim the
    // plan is being built: it waits for the answers left, and leads back to the question left.
    await page
      .getByRole("complementary", { name: "Sidebar" })
      .getByRole("link", { name: /^Today/u })
      .click();

    await expect(
      page.getByText("Your plan for Learn algebra needs a few more answers."),
    ).toBeVisible();

    await page.getByRole("link", { name: "Continue setting up" }).click();
    await expect(page).toHaveURL(new RegExp(`/start/${goal.id}$`, "u"));
    await expect(date).toBeVisible();

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("heading", { name: "What do you want from it?" })).toBeVisible();

    // "Start over", in words at the bar's end from `lg`, asks first. Starting over sets the goal aside
    // and goes back to typing a goal.
    await page.getByRole("button", { name: "Start over" }).click();

    const confirm = page.getByRole("alertdialog", { name: "Start over?" });
    await confirm.getByRole("button", { name: "Start over" }).click();
    await expect(page.getByRole("heading", { name: "What do you want to achieve?" })).toBeVisible();

    await expect
      .poll(async () => {
        const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
        return saved.status;
      })
      .toBe("archived");
  });
});

/** Next year: ahead of the server's today, and within what a plan reaches (3,650 days). */
const DEADLINE_YEAR = new Date().getUTCFullYear() + 1;

for (const boundary of [
  {
    localToday: `${DEADLINE_YEAR}-10-13`,
    now: `${DEADLINE_YEAR}-10-13T23:30:00-03:00`,
    timezoneId: "America/Sao_Paulo",
    tomorrow: `${DEADLINE_YEAR}-10-14`,
  },
  {
    localToday: `${DEADLINE_YEAR}-10-14`,
    now: `${DEADLINE_YEAR}-10-14T00:30:00+09:00`,
    timezoneId: "Asia/Tokyo",
    tomorrow: `${DEADLINE_YEAR}-10-15`,
  },
]) {
  test.describe(`Deadline in ${boundary.timezoneId}`, () => {
    test.use({ timezoneId: boundary.timezoneId });

    test("rejects today and accepts tomorrow across the UTC day boundary", async ({
      noProgressUser,
      userWithoutProgress: page,
    }) => {
      const goal = await createGoalBeingMapped({
        answered: [],
        runId: null,
        userId: noProgressUser.id,
      });

      await planFixture({ goalId: goal.id, phases: [] });

      await page.clock.setFixedTime(new Date(boundary.now));
      await page.goto(`/start/${goal.id}`);
      await page.getByRole("radio", { name: /Understand it in depth/u }).click();
      await page.getByRole("button", { exact: true, name: "Continue" }).click();

      const date = page.getByLabel("Date", { exact: true });
      const next = page.getByRole("button", { exact: true, name: "Continue" });
      await expect(date).toHaveAttribute("min", boundary.tomorrow);
      // No later than a plan reaches: the picker greys out what the server would refuse.
      await expect(date).toHaveAttribute("max", getTargetDateBounds(boundary.localToday).max);
      await date.fill(boundary.localToday);
      await expect(next).toBeDisabled();
      // A typed date the picker would have greyed out says why Continue waits.
      await expect(date).toHaveAccessibleDescription("Pick a date after today.");
      await date.fill(boundary.tomorrow);
      await expect(next).toBeEnabled();
      await expect(date).toHaveAccessibleDescription("");
      await next.click();

      await expect(
        page.getByRole("heading", { name: "How much do you already know?" }),
      ).toBeVisible();

      await expect
        .poll(async () => {
          const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
          return saved.targetDate?.toISOString().slice(0, 10);
        })
        .toBe(boundary.tomorrow);
    });
  });
}

test.describe("Waiting for placement's questions", () => {
  test("shows the run's progress, survives a refresh and moves on when questions arrive", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const runId = `e2e-steps-${randomUUID()}`;
    const goal = await createGoalBeingMapped({ runId, userId: noProgressUser.id });

    await followRun({
      events: [
        { entityId: goal.id, status: "started", step: "understandGoal" },
        { entityId: goal.id, status: "started", step: "buildSkillGraph" },
        { entityId: goal.id, status: "completed", step: "buildSkillGraph" },
        { entityId: goal.id, status: "started", step: "preparePlacement" },
      ],
      page,
      runId,
    });

    await page.goto(`/start/${goal.id}`);
    await page.getByRole("button", { exact: true, name: "Start" }).click();

    await expect(page.getByRole("heading", { name: "Getting your questions ready" })).toBeVisible();

    await expect(
      page.getByRole("progressbar", { name: "Getting your questions ready" }),
    ).toBeVisible();

    await expect(placementWait(page).nth(0)).toHaveText("Reading your goal, done");
    await expect(placementWait(page).nth(1)).toHaveText("Mapping the skills it takes, done");
    await expect(placementWait(page).nth(2)).toContainText("Writing your questions, in progress");

    // A refresh while waiting comes back to the wait, not to placement's start.
    await page.reload();

    await expect(page.getByRole("heading", { name: "Getting your questions ready" })).toBeVisible();

    // The run writes the skill map and its questions: the first one shows without a refresh.
    await mapGoalSkills({ goalId: goal.id });
    await expect(page.getByText("Question 1", { exact: true })).toBeVisible();
  });
});

test.describe("When a wait can't go on", () => {
  test("a failed run says so, and Try again starts it over", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const runId = `e2e-steps-${randomUUID()}`;
    const goal = await createGoalBeingMapped({ runId, userId: noProgressUser.id });

    await followRun({
      events: [
        { entityId: goal.id, status: "started", step: "understandGoal" },
        { entityId: goal.id, reason: "aiGenerationFailed", status: "error", step: "workflowError" },
      ],
      page,
      runId,
    });

    await page.goto(`/start/${goal.id}`);
    await page.getByRole("button", { exact: true, name: "Start" }).click();

    const failed = page.getByRole("alert").filter({ hasText: "This didn't finish" });
    await expect(failed).toBeVisible();
    await expect(page.getByRole("button", { name: "Skip for now" })).toBeVisible();
    await failed.getByRole("button", { name: "Try again" }).click();

    // The tap starts the run again: the wait follows it, or says the start failed with a way out.
    await expect(failed).toBeHidden();

    await expect(
      page
        .getByRole("progressbar", { name: "Getting your questions ready" })
        .or(page.getByRole("alert").filter({ hasText: "This didn't start" })),
    ).toBeVisible();
  });

  test("a lost connection says so after a few tries, and Reconnect follows the run again", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const runId = `e2e-steps-${randomUUID()}`;
    const goal = await createGoalBeingMapped({ runId, userId: noProgressUser.id });
    const event = { entityId: goal.id, status: "started", step: "buildSkillGraph" };
    let online = false;

    await page.route(`**/v1/generations/${runId}/events**`, (route) =>
      online
        ? route.fulfill({
            body: `data: ${JSON.stringify(event)}\n\n`,
            contentType: "text/event-stream",
            status: 200,
          })
        : route.abort(),
    );

    await page.route(`**/v1/generations/${runId}`, (route) =>
      online
        ? route.fulfill({ json: { id: runId, status: "running" }, status: 200 })
        : route.abort(),
    );

    await page.clock.install();
    await page.goto(`/start/${goal.id}`);
    await page.getByRole("button", { exact: true, name: "Start" }).click();

    const lost = page.getByRole("alert").filter({ hasText: "Connection lost" });

    // Each lost connection waits longer before the next try; the clock runs through them.
    await expect(async () => {
      await page.clock.runFor(CONNECTION_GIVE_UP_MS / 4);
      await expect(lost).toBeVisible({ timeout: 1000 });
    }).toPass();

    online = true;
    await lost.getByRole("button", { name: "Reconnect" }).click();

    await expect(lost).toBeHidden();

    await expect(placementWait(page).nth(1)).toContainText(
      "Mapping the skills it takes, in progress",
    );
  });

  test("a run that never starts is offered again while the learner is still answering", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await createGoalBeingMapped({
      answered: [],
      runId: null,
      userId: noProgressUser.id,
    });

    await page.clock.install();
    await page.goto(`/start/${goal.id}`);

    await expect(page.getByRole("heading", { name: "What do you want from it?" })).toBeVisible();

    // Picking an answer shows the page is interactive, so its wait for the run has begun; a
    // one-answer question then moves on by itself.
    const deep = page.getByRole("radio", { name: /Understand it in depth/u });
    await deep.click();
    await expect(deep).toBeChecked();

    await page.clock.runFor(RUN_START_LIMIT_MS);

    const notice = page
      .getByRole("alert")
      .filter({ hasText: "We couldn't start building your plan" });

    await expect(notice).toBeVisible();
    await expect(notice).toContainText("Your answers are saved.");

    // The learner keeps answering under the notice.
    const nextQuestion = page.getByRole("heading", { name: "Is there a date you're aiming for?" });
    await expect(nextQuestion).toBeVisible();

    // The API accepts the learner's retry. Stand in for the new run's failure at the browser's
    // stream boundary: server-side API calls are reachable and page.route cannot intercept them.
    await page.route("**/v1/generations/*/events**", (route) =>
      route.fulfill({
        body: `data: ${JSON.stringify({ entityId: goal.id, reason: "aiGenerationFailed", status: "error", step: "workflowError" })}\n\n`,
        contentType: "text/event-stream",
        status: 200,
      }),
    );

    await page.route(/\/v1\/generations\/[^/]+$/u, (route) =>
      route.fulfill({ json: { status: "failed" }, status: 200 }),
    );

    await notice.getByRole("button", { name: "Try again" }).click();

    const stopped = page.getByRole("alert").filter({ hasText: "Building your plan stopped" });
    await expect(stopped).toBeVisible();
    await expect(stopped).toContainText("Your answers are saved.");
    await expect(nextQuestion).toBeVisible();

    await expect
      .poll(async () => {
        const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
        return saved.generationRunId;
      })
      .toEqual(expect.any(String));
  });

  test("placement with no questions to ask goes on without them", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await createGoalBeingMapped({ runId: null, userId: noProgressUser.id });
    await mapGoalSkills({ goalId: goal.id, items: false, placementPrepared: true });
    await page.goto(`/start/${goal.id}`);

    await page.getByRole("button", { exact: true, name: "Start" }).click();
    await expect(page.getByRole("heading", { name: "Let's skip the questions" })).toBeVisible();
    await page.getByRole("button", { name: "See my plan" }).click();

    await expect(page.getByText("Plan created", { exact: true })).toBeVisible();

    await expect
      .poll(async () => {
        const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
        return saved.details;
      })
      .toMatchObject({ answered: expect.arrayContaining(["placement"]) });
  });

  test("the level test's wait survives a refresh, says when writing stopped and asks again on a tap", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    // A pair no other test uses, whose questions another run is writing.
    const pair = { language: "pt", targetLanguage: "fi" };

    const writing = {
      content: {},
      generatedAt: new Date(Date.now() - 30_000),
      model: "",
      promptVersion: "",
      runId: "e2e-steps-writer",
    };

    await prisma.languageLevelTest.upsert({
      create: { ...pair, ...writing },
      update: writing,
      where: { languagePair: pair },
    });

    const goal = await goalFixture({
      details: { answered: [...ANSWERED, "reason"], level: "A2", reason: "Viagem" },
      kind: "language",
      language: pair.language,
      prompt: `aprender finlandês ${randomUUID()}`,
      targetLanguage: pair.targetLanguage,
      title: "Finlandês para viajar",
      userId: noProgressUser.id,
    });

    await page.goto(`/start/${goal.id}`);
    await page.getByRole("button", { exact: true, name: "Start" }).click();
    const progress = page.getByRole("progressbar", { name: "Preparing your level test" });
    await expect(progress).toBeVisible();

    // A refresh comes back to the wait, following the writer at work.
    await page.reload();
    await expect(progress).toBeVisible();
    await expect(page.getByRole("button", { exact: true, name: "Start" })).toBeHidden();

    // The writer gives up: its claim goes stale with nothing written.
    await prisma.languageLevelTest.update({
      data: { generatedAt: new Date(Date.now() - STALE_WRITER_MS) },
      where: { languagePair: pair },
    });

    const stopped = page.getByRole("alert").filter({ hasText: "This didn't finish" });
    await expect(stopped).toBeVisible();
    await expect(page.getByRole("button", { name: "Skip the test" })).toBeVisible();
    await stopped.getByRole("button", { name: "Try again" }).click();

    // The API accepts the retry and a new writer claims the pair. The test environment blocks
    // its model calls, but that happens after the start succeeds: it resumes the preparation wait.
    await expect(stopped).toBeHidden();
    await expect(progress).toBeVisible();

    await expect
      .poll(async () => {
        const bank = await prisma.languageLevelTest.findUniqueOrThrow({
          where: { languagePair: pair },
        });

        return { fresh: bank.runId !== writing.runId, runId: bank.runId };
      })
      .toEqual({ fresh: true, runId: expect.any(String) });

    await expect(page.getByRole("button", { name: "Skip the test" })).toBeVisible();
  });
});
