import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
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
  test("comes back to the same question, with the dots, Back and Start over", async ({
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
    await page.getByRole("button", { name: "Back" }).click();

    await expect(page.getByRole("heading", { name: "What do you want from it?" })).toBeVisible();

    // Onboarding is a task: no app bar, and its close starts over, after asking. Starting over sets
    // the goal aside and goes back to the first question.
    await expect(page.getByRole("button", { name: /current goal/iu })).toHaveCount(0);
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

    // Picking an answer shows the page is interactive, so its wait for the run has begun.
    const deep = page.getByRole("radio", { name: /Understand it in depth/u });
    await deep.click();
    await expect(deep).toBeChecked();

    await page.clock.runFor(RUN_START_LIMIT_MS);

    const notice = page
      .getByRole("alert")
      .filter({ hasText: "We couldn't start building your plan" });

    await expect(notice).toBeVisible();
    await expect(notice).toContainText("Your answers are saved.");

    // Starting it again is the learner's tap; here the API can't be reached, so it says so again.
    await notice.getByRole("button", { name: "Try again" }).click();
    await expect(notice).toBeVisible();

    await expect(page.getByRole("heading", { name: "What do you want from it?" })).toBeVisible();
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

    await expect(page.getByRole("heading", { level: 1, name: "Your plan is ready" })).toBeVisible();

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

    // The tap asks the API to write them; it can't be reached here, so the wait says so.
    await expect(page.getByRole("alert").filter({ hasText: "This didn't start" })).toBeVisible();
  });
});
