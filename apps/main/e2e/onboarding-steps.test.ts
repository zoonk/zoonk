import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectHydrated } from "@zoonk/e2e/hydration";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { expect, test } from "./fixtures";
import { followRun, stopRuns } from "./generation-run";
import { ANSWERED, mapGoalSkills } from "./onboarding-fixtures";

/** The page gives a run 45 s to appear. */
const RUN_START_LIMIT_MS = 46_000;

/** Placement checks every 3 s, and a check in flight as the questions land leaves them to the next. */
const NEXT_CHECK_TIMEOUT_MS = 10_000;

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

test.describe("Refreshing mid-onboarding", () => {
  test("comes back to the same question, and Start over sets the goal aside", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await createGoalBeingMapped({
      answered: [],
      runId: null,
      userId: noProgressUser.id,
    });

    await page.goto(`/start/${goal.id}`);

    const purpose = page.getByRole("radio", { name: /Understand it in depth/u });
    await expectHydrated(purpose);
    await purpose.click();

    const level = page.getByRole("heading", { name: "How much do you already know?" });
    await expect(level).toBeVisible();

    await page.reload();
    await expect(level).toBeVisible();

    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: /^Start over/u }).click();

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
  test("survives a refresh and moves on when questions arrive", async ({
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

    await page.reload();

    await expect(page.getByRole("heading", { name: "Getting your questions ready" })).toBeVisible();

    await mapGoalSkills({ goalId: goal.id });

    await expect(page.getByText("Question 1", { exact: true })).toBeVisible({
      timeout: NEXT_CHECK_TIMEOUT_MS,
    });
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

    await expect(failed).toBeHidden();

    await expect(
      page
        .getByRole("progressbar", { name: "Getting your questions ready" })
        .or(page.getByRole("alert").filter({ hasText: "This didn't start" })),
    ).toBeVisible();
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
    await expectHydrated(deep);
    await deep.click();
    await expect(deep).toBeChecked();

    // The clock jumps past the limit rather than running through it, which would fire the 2 s ask
    // for the run's id some 20 times at once.
    await page.clock.fastForward(RUN_START_LIMIT_MS);

    const notice = page
      .getByRole("alert")
      .filter({ hasText: "We couldn't start building your plan" });

    await expect(notice).toBeVisible();

    const nextQuestion = page.getByRole("heading", { name: "How much do you already know?" });
    await expect(nextQuestion).toBeVisible();

    await stopRuns({ entityId: goal.id, page });

    await notice.getByRole("button", { name: "Try again" }).click();

    const stopped = page.getByRole("alert").filter({ hasText: "Building your plan stopped" });
    await expect(stopped).toBeVisible();
    await expect(nextQuestion).toBeVisible();

    await expect
      .poll(async () => {
        const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
        return saved.generationRunId;
      })
      .toEqual(expect.any(String));
  });
});

test.describe("Why a language learner studies it", () => {
  test("sets how far the course goes: a trip aims it at A2", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const goal = await goalFixture({
      details: { answered: [], level: "none", subject: "Italian" },
      kind: "language",
      planRevealedAt: null,
      prompt: `learn italian ${randomUUID()}`,
      targetLanguage: "it",
      title: "Learn Italian",
      userId: noProgressUser.id,
    });

    await page.goto(`/start/${goal.id}`);

    const travel = page.getByRole("radio", { name: /^Travel/u });
    await expectHydrated(travel);
    await travel.click();

    await expect(page.getByRole("heading", { name: "Why are you learning it?" })).toBeHidden();

    await expect
      .poll(async () => {
        const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
        return saved.details;
      })
      .toMatchObject({ reason: "travel", targetScore: "A2" });
  });
});
