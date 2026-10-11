import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import {
  CHECKPOINT_PASS_MARK,
  CHECKPOINT_QUESTIONS,
  MOCK_MINUTES,
  THIN_CHECKPOINT,
  createCheckpointLearner,
  createUpcomingBoss,
  playDuel,
  starShownAt,
} from "./checkpoint-fixtures";
import { expect, test } from "./fixtures";
import { type StreamEvent, followRun } from "./generation-run";
import { continueToLastStep, nextStep, stepDots } from "./result-steps";
import { openAs } from "./study-day";

async function planItemStatus(id: string) {
  const item = await prisma.planItem.findUniqueOrThrow({ where: { id } });
  return item.status;
}

test.describe("Checkpoints", () => {
  test("the Trickster's checkpoint says what it asks before its day, without a way to start it yet", async ({
    browser,
  }) => {
    const { boss, user } = await createUpcomingBoss();
    const page = await openAs(browser, user);

    await page.goto(`/challenge/${boss.id}`);

    await expect(page.getByRole("heading", { level: 1, name: "The Trickster" })).toBeVisible();
    await expect(page.getByText("Phase 1 challenge", { exact: true })).toBeVisible();

    await expect(page.getByText("Mixed questions from this phase, with no hints.")).toBeVisible();
    await expect(page.getByText("10 questions", { exact: true })).toBeVisible();
    await expect(page.getByText("7 right to win", { exact: true })).toBeVisible();

    await expect(page.getByText(/^Opens /u)).toBeVisible();
    await expect(page.getByRole("button", { name: "Start" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Move to Monday" })).toHaveCount(0);
    await expectAccessibleScreen(page, "a checkpoint before its day");

    await page.context().close();
  });

  test("winning breaks the Trickster's shield, checks the phase off and explains the answers", async ({
    browser,
  }) => {
    const { block, boss, user } = await createCheckpointLearner();
    const page = await openAs(browser, user);

    // Before it starts, the checkpoint's own page is its challenge's intro.
    await page.goto(`/checkpoint/${block.id}`);
    await expect(page).toHaveURL(new RegExp(`/challenge/${boss.id}$`, "u"));

    await expect(
      page.getByText(`${CHECKPOINT_QUESTIONS} questions`, { exact: true }),
    ).toBeVisible();

    await expect(
      page.getByText(`${CHECKPOINT_PASS_MARK} right to win`, { exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Start" }).click();
    await expect(page).toHaveURL(new RegExp(`/checkpoint/${block.id}$`, "u"));

    const shield = page.getByRole("meter", { name: "The Trickster's shield" });
    await expect(shield).toHaveAttribute("aria-valuemax", String(CHECKPOINT_PASS_MARK));
    await expect(shield).toHaveAttribute("aria-valuenow", "0");
    await expectAccessibleScreen(page, "the Trickster's duel");

    await playDuel(page);

    // The result says one thing at a time: how it went, what it earned, then the next phase.
    await expect(
      page.getByRole("heading", { level: 1, name: "You beat the Trickster!" }),
    ).toBeVisible();

    await expect(
      page.getByText(`${CHECKPOINT_QUESTIONS} of ${CHECKPOINT_QUESTIONS} right`),
    ).toBeVisible();

    await expect(stepDots(page)).toHaveAttribute("aria-label", "Step 1 of 3");
    await expectAccessibleScreen(page, "a checkpoint's result");

    await nextStep(page);
    await expect(page.getByRole("heading", { level: 1, name: /Brain Power$/u })).toBeVisible();
    await expect(page.getByText("Phase 1 complete")).toBeVisible();
    await expect(page.getByText("Trap hunter badge")).toBeVisible();

    await nextStep(page);
    await expect(page.getByText("Next phase", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Practice" })).toBeVisible();

    // The answers and their traps wait behind a link, in a sheet that Escape closes.
    await page.getByRole("button", { name: "Review the answers" }).click();
    const answers = page.getByRole("dialog", { name: "The answers" });
    await expect(answers.getByText("It follows the rule.")).toHaveCount(CHECKPOINT_QUESTIONS);
    await page.keyboard.press("Escape");
    await expect(answers).toBeHidden();

    await expect.poll(() => planItemStatus(boss.id)).toBe("done");

    // Opened on its own rather than from today's session, it continues to Today.
    await expect(page.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/today");

    // Reopened once won, its challenge says how it went instead of inviting a duel already played.
    await page.goto(`/challenge/${boss.id}`);

    await expect(
      page.getByRole("heading", { level: 1, name: "You beat the Trickster!" }),
    ).toBeVisible();

    await expect(
      page.getByText(`${CHECKPOINT_QUESTIONS} of ${CHECKPOINT_QUESTIONS} right`),
    ).toBeVisible();

    await expect(page.getByText(`${CHECKPOINT_PASS_MARK} right to win`)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Start" })).toHaveCount(0);

    await expect(page.getByRole("link", { name: "See how it went" })).toHaveAttribute(
      "href",
      `/checkpoint/${block.id}`,
    );

    await page.context().close();
  });

  test("not passing costs nothing: a new try tomorrow, and the next phase open", async ({
    browser,
  }) => {
    const { block, boss, user } = await createCheckpointLearner();
    const page = await openAs(browser, user);

    await page.goto(`/challenge/${boss.id}`);
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page).toHaveURL(new RegExp(`/checkpoint/${block.id}$`, "u"));
    await playDuel(page, { answer: "Wrong answer" });

    await expect(page.getByRole("heading", { level: 1, name: "Not this time" })).toBeVisible();

    await expect(
      page.getByText(`0 of ${CHECKPOINT_QUESTIONS} right. Winning takes 5.`),
    ).toBeVisible();

    // A new try, and the next phase named: nothing is locked.
    await nextStep(page);
    await expect(page.getByRole("heading", { level: 1, name: "New try tomorrow" })).toBeVisible();
    await expect(page.getByText("The next phase, Practice, is already open.")).toBeVisible();
    await expect(page.getByText("Trap hunter badge")).toHaveCount(0);

    await expect.poll(() => planItemStatus(boss.id)).toBe("todo");

    // Its intro says so too, and opens how it went.
    await page.goto(`/challenge/${boss.id}`);

    await expect(
      page.getByText("New try tomorrow, after 2 short lessons. Nothing is lost."),
    ).toBeVisible();

    await page.getByRole("link", { name: "See how it went" }).click();
    await expect(page).toHaveURL(new RegExp(`/checkpoint/${block.id}$`, "u"));
    await expect(page.getByRole("heading", { level: 1, name: "Not this time" })).toBeVisible();
    await nextStep(page);
    await expect(page.getByRole("heading", { level: 1, name: "New try tomorrow" })).toBeVisible();

    await page.context().close();
  });

  test("the week's mock says when, how long and its one rule, and starts from its intro", async ({
    browser,
  }) => {
    const { block, boss, user } = await createCheckpointLearner({ kind: "weekly" });
    const page = await openAs(browser, user);

    // A weekly mock is introduced by its challenge and runs in real conditions on its own screen.
    await page.goto(`/checkpoint/${block.id}`);
    await expect(page).toHaveURL(new RegExp(`/challenge/${boss.id}$`, "u"));

    await expect(page.getByRole("heading", { level: 1, name: "Mock exam 1" })).toBeVisible();

    await expect(
      page.getByText(`${CHECKPOINT_QUESTIONS} questions`, { exact: true }),
    ).toBeVisible();

    // About how long it takes: the exam's pace until learners' own is known.
    await expect(page.getByText(`About ${MOCK_MINUTES} min`, { exact: true })).toBeVisible();

    await expect(
      page.getByText("Your result only shows at the end, like on exam day."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Start the mock exam" }).click();
    await expect(page).toHaveURL(new RegExp(`/mock/${block.id}$`, "u"));

    await expect(
      page.getByText(new RegExp(`^Question 1 of ${CHECKPOINT_QUESTIONS}`, "u")),
    ).toBeVisible();

    await page.context().close();
  });
});

const GENERATIONS_URL = "**/v1/challenges/*/generations";

/**
 * A challenge the bank held too few questions for when today's session was planned: it stays in
 * the day, and Start writes what it lacks before it opens. Tests never reach a model: the API's
 * writing run is stood in for.
 */
test.describe("A challenge whose questions aren't written yet", () => {
  test("writes them on Start, shows the wait, then opens with all ten", async ({ browser }) => {
    const { block, boss, user, writeQuestions } = await createCheckpointLearner({ thin: true });
    const runId = `e2e-challenge-${randomUUID()}`;
    const page = await openAs(browser, user);
    const events: StreamEvent[] = [];

    await page.route(GENERATIONS_URL, (route) =>
      route.fulfill({ json: { generationId: runId, status: "generating" }, status: 202 }),
    );

    await followRun({ events, page, runId });
    await page.goto(`/challenge/${boss.id}`);

    // It promises what it will ask, never the few questions the bank has now.
    await expect(
      page.getByText(`${THIN_CHECKPOINT.questions} questions`, { exact: true }),
    ).toBeVisible();

    await expect(
      page.getByText(`${THIN_CHECKPOINT.passMark} right to win`, { exact: true }),
    ).toBeVisible();

    events.push({ status: "started", step: "writeChallengeQuestions" });

    // Taps work once the page hydrates, so a first tap retries until the screen changes.
    await expect(async () => {
      await page.getByRole("button", { name: "Start" }).click({ timeout: 1000 });
      await expect(page.getByText("Getting your challenge ready")).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15_000 });

    await expect(page.getByRole("progressbar", { name: "Writing your challenge" })).toBeVisible();
    await expectAccessibleScreen(page, "a challenge whose questions are being written");

    await writeQuestions();
    events.push({ status: "completed", step: "challengeQuestionsReady" });

    // No tap: it opens once its questions exist.
    await expect(
      page.getByText(`Question 1 of ${THIN_CHECKPOINT.questions}`, { exact: true }),
    ).toBeVisible();

    await expect(page).toHaveURL(new RegExp(`/checkpoint/${block.id}$`, "u"));
    await page.context().close();
  });

  // A skill whose questions keep failing never holds the challenge back: once the run ends, it
  // opens with what the bank has, if that's enough to judge the phase.
  test("opens with the questions written when one of the run's calls fails", async ({
    browser,
  }) => {
    const { boss, user, writeQuestions } = await createCheckpointLearner({ thin: true });
    const runId = `e2e-challenge-${randomUUID()}`;
    const page = await openAs(browser, user);
    const events: StreamEvent[] = [{ status: "started", step: "writeChallengeQuestions" }];

    await page.route(GENERATIONS_URL, (route) =>
      route.fulfill({ json: { generationId: runId, status: "generating" }, status: 202 }),
    );

    await followRun({ events, page, runId });
    await page.goto(`/challenge/${boss.id}`);

    await expect(async () => {
      await page.getByRole("button", { name: "Start" }).click({ timeout: 1000 });
      await expect(page.getByText("Getting your challenge ready")).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15_000 });

    await writeQuestions(1);
    events.push({ status: "completed", step: "challengeQuestionsReady" });

    await expect(page.getByText("Question 1 of 6", { exact: true })).toBeVisible();
    await page.context().close();
  });

  test("opens with the questions it has when the run writes none", async ({ browser }) => {
    const { boss, user, writeQuestions } = await createCheckpointLearner({ thin: true });
    const runId = `e2e-challenge-${randomUUID()}`;
    const page = await openAs(browser, user);
    const events: StreamEvent[] = [{ status: "started", step: "writeChallengeQuestions" }];

    // An earlier run wrote one skill's questions: six, short of the ten Start waits for.
    await writeQuestions(1);

    await page.route(GENERATIONS_URL, (route) =>
      route.fulfill({ json: { generationId: runId, status: "generating" }, status: 202 }),
    );

    await followRun({ events, page, runId });
    await page.goto(`/challenge/${boss.id}`);

    await expect(async () => {
      await page.getByRole("button", { name: "Start" }).click({ timeout: 1000 });
      await expect(page.getByText("Getting your challenge ready")).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15_000 });

    events.push({ reason: "aiGenerationFailed", status: "error", step: "workflowError" });

    await expect(page.getByText("Question 1 of 6", { exact: true })).toBeVisible();
    await page.context().close();
  });

  test("says why when today's help is used up, instead of starting", async ({ browser }) => {
    const { boss, user } = await createCheckpointLearner({ thin: true });
    const page = await openAs(browser, user);

    await page.route(GENERATIONS_URL, (route) =>
      route.fulfill({ json: { error: { code: "USAGE_LIMIT_REACHED", details: {} } }, status: 402 }),
    );

    await page.goto(`/challenge/${boss.id}`);

    await expect(async () => {
      await page.getByRole("button", { name: "Start" }).click({ timeout: 1000 });

      await expect(
        page.getByText(
          "You've used today's help. It comes back tomorrow, or get Plus to keep going now.",
        ),
      ).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15_000 });

    await expect(page.getByRole("link", { name: "See Plus" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start" })).toHaveCount(0);
    await page.context().close();
  });
});

test.describe("A checkpoint from today's session", () => {
  test("opens on its intro from Today and starts in one tap", async ({ browser }) => {
    const { block, boss, user } = await createCheckpointLearner();
    const page = await openAs(browser, user);

    await page.goto("/today");

    // Taps work once the page hydrates, so a first tap retries until the screen changes.
    await expect(async () => {
      await page.getByRole("button", { name: "Start" }).click({ timeout: 1000 });

      await expect(page).toHaveURL(new RegExp(`/challenge/${boss.id}\\?session=`, "u"), {
        timeout: 1000,
      });
    }).toPass({ timeout: 10_000 });

    // One tap on Start opens the duel, never this intro again with a Continue to tap (the block's
    // page redirected Today's tap here, and the router kept that redirect for its address).
    await expect(async () => {
      await page.getByRole("button", { name: "Start" }).click({ timeout: 1000 });

      await expect(page.getByText(`Question 1 of ${CHECKPOINT_QUESTIONS}`)).toBeVisible({
        timeout: 5000,
      });
    }).toPass({ timeout: 15_000 });

    await expect(page).toHaveURL(new RegExp(`/checkpoint/${block.id}\\?session=`, "u"));
    await page.context().close();
  });

  test("continues back to the session by keyboard, to the day's summary", async ({ browser }) => {
    const { block, boss, user } = await createCheckpointLearner();
    const page = await openAs(browser, user);

    await page.goto("/today");

    // Keys work once the page hydrates, so each first press retries until the screen changes.
    await expect(async () => {
      await page.keyboard.press("Enter");

      // Its intro is the challenge's page, keeping the session it came from.
      await expect(page).toHaveURL(new RegExp(`/challenge/${boss.id}\\?session=`, "u"), {
        timeout: 1000,
      });
    }).toPass({ timeout: 10_000 });

    await expect(async () => {
      await page.keyboard.press("Enter");

      await expect(page.getByText(`Question 1 of ${CHECKPOINT_QUESTIONS}`)).toBeVisible({
        timeout: 1000,
      });
    }).toPass({ timeout: 5000 });

    await expect(page).toHaveURL(new RegExp(`/checkpoint/${block.id}\\?session=`, "u"));

    await playDuel(page, { keyboard: true });

    // Enter goes through the result's steps, then on to the session.
    await expect(
      page.getByRole("heading", { level: 1, name: "You beat the Trickster!" }),
    ).toBeVisible();

    await continueToLastStep(page, { keyboard: true });
    await expect(page.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/session");
    await page.keyboard.press("Enter");

    // The checkpoint was the day's only block, so the session shows the day's summary.
    await expect(page).toHaveURL(/\/session$/u);
    await expect(page.getByRole("heading", { level: 1, name: "Session complete" })).toBeVisible();

    // Winning the first checkpoint earned the Star glasses: their own moment, before the last step.
    await continueToLastStep(page, { keyboard: true });
    const ceremony = page.getByRole("dialog", { name: "Star glasses!" });
    await expect(ceremony.getByRole("button", { name: "Continue" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(ceremony).toBeHidden();
    await expect.poll(() => starShownAt(user.id)).not.toBeNull();

    // The step under it takes the focus, and Enter finishes the day.
    await expect(page.getByRole("button", { name: "Finish" })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/today$/u);

    await page.context().close();
  });
});

/** The week's challenges of a plan, as learner-local days. */
async function challengeDays(planId: string) {
  const items = await prisma.planItem.findMany({
    where: { kind: { in: ["checkpoint", "mock"] }, planId, status: "todo" },
  });

  return items.map((item) => item.scheduledFor?.toISOString().slice(0, 10));
}

async function blockStatus(blockId: string) {
  const block = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } });
  return block.status;
}

test.describe("Move to Monday", () => {
  test("the week's challenge moves to Monday through the plan, with undo", async ({ browser }) => {
    const { block, boss, plan, user } = await createCheckpointLearner({
      kind: "weekly",
      planned: true,
    });

    const page = await openAs(browser, user);

    await page.goto(`/challenge/${boss.id}`);
    const move = page.getByRole("button", { name: "Move to Monday" });
    await expect(move).toBeVisible();
    await expectAccessibleScreen(page, "the week's challenge");
    await move.click();

    await expect(page.getByRole("heading", { name: /^Moved to/u })).toBeVisible();
    await expect(page.getByText("Your plan made room for it. Nothing is lost.")).toBeVisible();
    await expect.poll(() => blockStatus(block.id)).toBe("skipped");

    // A dated plan item is a new one on its new day: the page follows it.
    await expect(page).not.toHaveURL(new RegExp(boss.id, "u"));
    const days = await challengeDays(plan.id);
    expect(days.some((day) => day && new Date(`${day}T00:00:00Z`).getUTCDay() === 1)).toBe(true);

    await page.getByRole("button", { name: "Undo" }).click();

    await expect(page.getByRole("button", { name: "Move to Monday" })).toBeVisible();
    await expect(page).not.toHaveURL(/moved=/u);
    await expect.poll(() => blockStatus(block.id)).toBe("pending");

    await page.context().close();
  });
});
