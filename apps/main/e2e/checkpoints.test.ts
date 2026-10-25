import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { isJsonObject } from "@zoonk/utils/json";
import {
  CHECKPOINT_PASS_MARK,
  CHECKPOINT_QUESTIONS,
  MOCK_MINUTES,
  THIN_CHECKPOINT,
  createCheckpointLearner,
  playDuel,
  starShownAt,
} from "./checkpoint-fixtures";
import { expect, test } from "./fixtures";
import { type StreamEvent, followRun } from "./generation-run";
import { openAs } from "./study-day";
import { createUpcomingBoss } from "./upcoming-checkpoint-fixture";

async function planItemStatus(id: string) {
  const item = await prisma.planItem.findUniqueOrThrow({ where: { id } });
  return item.status;
}

test.describe("Checkpoints", () => {
  test("a duel whose questions vanished ends without judging the learner", async ({ browser }) => {
    const { block, boss, items, user } = await createCheckpointLearner();
    const page = await openAs(browser, user);
    await page.setViewportSize({ height: 720, width: 390 });
    await page.goto(`/challenge/${boss.id}`);
    await page.getByRole("button", { exact: true, name: "Start" }).click();
    await expect(page.getByRole("radio", { name: "Right answer" })).toBeVisible();
    await prisma.item.deleteMany({ where: { id: { in: items.map((item) => item.id) } } });
    await page.getByRole("radio", { name: "Right answer" }).click();
    await page.getByRole("button", { name: "Confirm" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "The questions were removed" }),
    ).toBeVisible();

    await expect(
      page.getByText(
        "You hadn't answered any yet, so this challenge isn't scored. Nothing is lost.",
        { exact: true },
      ),
    ).toBeVisible();

    await expect(page.getByRole("meter", { name: "The Trickster's shield" })).toHaveCount(0);
    await expect(page.getByText("Brain Power", { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "See how it went" }).click();
    await expect(page.getByRole("link", { exact: true, name: "Continue" })).toBeVisible();

    await expect(
      page.getByRole("heading", { level: 1, name: "The questions were removed" }),
    ).toBeVisible();

    await expect(
      page.getByText(
        "You hadn't answered any yet, so this challenge isn't scored. Nothing is lost.",
        { exact: true },
      ),
    ).toBeVisible();

    await page.reload();

    await expect(
      page.getByRole("heading", { level: 1, name: "The questions were removed" }),
    ).toBeVisible();

    await expect(
      page.getByText(
        "You hadn't answered any yet, so this challenge isn't scored. Nothing is lost.",
        { exact: true },
      ),
    ).toBeVisible();

    await expect(page.getByText("You beat the Trickster!", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Not this time", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Brain Power", { exact: true })).toHaveCount(0);
    await expectAccessibleScreen(page, "an empty challenge ended without a verdict");
    await expect.poll(() => planItemStatus(boss.id)).toBe("todo");

    await expect
      .poll(async () => {
        const saved = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } });
        return saved.status;
      })
      .toBe("skipped");

    await page.getByRole("link", { exact: true, name: "Continue" }).click();
    await expect(page).toHaveURL(/\/today$/u);
    await page.context().close();
  });

  test("a decided duel stays lost when an answered question disappears before finishing", async ({
    browser,
  }) => {
    const { block, boss, items, user } = await createCheckpointLearner();
    const page = await openAs(browser, user);
    await page.goto(`/challenge/${boss.id}`);
    await page.getByRole("button", { exact: true, name: "Start" }).click();
    await playDuel(page, { answer: "Wrong answer", passMark: CHECKPOINT_PASS_MARK, until: 1 });
    await page.getByRole("radio", { name: "Wrong answer" }).click();
    await page.getByRole("button", { name: "Confirm" }).click();

    await expect(page.getByRole("status")).toHaveText(/^Not quite\s*His shield held this time\./u);

    await prisma.item.delete({ where: { id: items[0]?.id } });
    await page.reload();
    await expect(page.getByRole("status")).toHaveText(/^His shield held this time\./u);
    await expect(page.getByRole("radio")).toHaveCount(0);
    await page.getByRole("button", { name: "See how it went" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Not this time" })).toBeVisible();
    await expect(page.getByText("0 of 2 right", { exact: true })).toBeVisible();
    await expect.poll(() => planItemStatus(boss.id)).toBe("todo");

    await expect
      .poll(async () => {
        const saved = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } });
        return saved.status;
      })
      .toBe("completed");

    // Reopened once every question is deleted, it keeps the score it earned.
    await prisma.item.deleteMany({ where: { id: { in: items.map((item) => item.id) } } });
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Not this time" })).toBeVisible();
    await expect(page.getByText("0 of 2 right", { exact: true })).toBeVisible();
    await expect(page.getByText(/right to win/u)).toHaveCount(0);
    await expect(page.getByRole("link", { exact: true, name: "Continue" })).toBeVisible();

    await page.context().close();
  });

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

  test("Start refreshes a due offer omitted from the opened day instead of asking to retry", async ({
    browser,
  }) => {
    const { boss, user } = await createUpcomingBoss();
    const today = toUTCMidnight(new Date());
    const plan = await prisma.plan.findUniqueOrThrow({ where: { id: boss.planId } });

    // The commitment is due, but today's saved calendar is a rest day. Only Start opens the day
    // and finds it has no block for this offer; the intro must then read that saved outcome.
    await Promise.all([
      prisma.planItem.update({ data: { scheduledFor: today }, where: { id: boss.id } }),
      prisma.plan.update({
        data: {
          settings: {
            startDate: new Date(today.getTime() - MS_PER_DAY).toISOString().slice(0, 10),
            weekdayMinutes: Array.from({ length: 7 }, (_, weekday) =>
              weekday === today.getUTCDay() ? 0 : 20,
            ),
          },
        },
        where: { id: plan.id },
      }),
    ]);

    const context = await browser.newContext({
      storageState: user.storageState,
      timezoneId: "UTC",
    });

    const page = await context.newPage();
    await page.goto(`/challenge/${boss.id}`);
    await expect(page.getByRole("button", { exact: true, name: "Start" })).toBeEnabled();
    expect(await prisma.studySession.count({ where: { goalId: plan.goalId } })).toBe(0);
    await page.getByRole("button", { exact: true, name: "Start" }).click();

    // No manual reload: the owning host re-reads after the POST, without a generic error or busy loop.
    await expect(page.getByText("In your next session", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start" })).toHaveCount(0);
    await expect(page.getByText("That didn't go through. Try again in a moment.")).toHaveCount(0);

    await expect(page.getByText("Still starting. This is taking longer than usual.")).toHaveCount(
      0,
    );

    await expect(page).toHaveURL(new RegExp(`/challenge/${boss.id}$`, "u"));

    const session = await prisma.studySession.findFirstOrThrow({
      include: { blocks: true },
      where: { goalId: plan.goalId, localDate: today },
    });

    expect(session.blocks).toHaveLength(0);
    await page.reload();
    await expect(page.getByText("In your next session", { exact: true })).toBeVisible();
    await context.close();
  });

  test("Start on a checkpoint whose reinforcement lesson the saved day puts first says so politely instead of asking to retry", async ({
    browser,
  }) => {
    const { block, boss, user } = await createCheckpointLearner();
    const page = await openAs(browser, user);

    await page.goto(`/challenge/${boss.id}`);
    const start = page.getByRole("button", { exact: true, name: "Start" });
    const statusRegion = page.locator("[data-slot='task-action-bar'] [aria-live='polite']");
    await expect(start).toBeEnabled();

    // The bar's polite region is already there, empty, so a line that later replaces Start is
    // inserted into it and read out. One mounted together with its line would stay silent.
    await expect(statusRegion).toBeAttached();
    await expect(statusRegion).toBeEmpty();

    // Meanwhile another tab saves today's order with a rematch's short lesson before the duel:
    // Start refuses, and the intro reads that order.
    await prisma.studySessionBlock.update({ data: { position: 1 }, where: { id: block.id } });

    const lesson = await prisma.studySessionBlock.create({
      data: {
        kind: "learn",
        payload: { reinforcement: true },
        position: 0,
        sessionId: block.sessionId,
      },
    });

    await start.click();

    // The line replaces the Start that had focus, in the bar's polite region, with no error to
    // retry and no busy loop.
    await expect(statusRegion.getByText("After today's lessons", { exact: true })).toBeVisible();

    await expect(start).toHaveCount(0);
    await expect(page.getByText("That didn't go through. Try again in a moment.")).toHaveCount(0);

    await expect(page.getByText("Still starting. This is taking longer than usual.")).toHaveCount(
      0,
    );

    await expect(page).toHaveURL(new RegExp(`/challenge/${boss.id}$`, "u"));
    await expect.poll(() => planItemStatus(boss.id)).toBe("todo");

    await expect
      .poll(async () => {
        const saved = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } });
        return saved.status;
      })
      .toBe("pending");

    await page.reload();
    await expect(page.getByText("After today's lessons", { exact: true })).toBeVisible();
    await expect(start).toHaveCount(0);

    // Once the lesson is skipped, the duel is the next thing: Start opens it.
    await prisma.studySessionBlock.update({
      data: { status: "skipped" },
      where: { id: lesson.id },
    });

    await page.reload();
    await start.click();
    await expect(page).toHaveURL(new RegExp(`/checkpoint/${block.id}$`, "u"));

    await page.context().close();
  });

  test("winning breaks the Trickster's shield, checks the phase off and explains the answers", async ({
    browser,
  }) => {
    const { block, boss, items, user } = await createCheckpointLearner();
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

    // What he'll ask beside the intro: the topics of the duel's questions.
    await expect(page.getByRole("complementary", { name: "What he'll ask" })).toBeVisible();
    await expect(page.getByText(/^Discounts /u)).toBeVisible();
    await expect(page.getByText(/^Ratios /u)).toBeVisible();

    await page.getByRole("button", { name: "Start" }).click();
    await expect(page).toHaveURL(new RegExp(`/checkpoint/${block.id}$`, "u"));

    const duelAside = page.getByRole("complementary", { name: "Phase 1 challenge" });
    const shield = duelAside.getByRole("meter", { name: "The Trickster's shield" });
    await expect(shield).toHaveAttribute("aria-valuemax", String(CHECKPOINT_PASS_MARK));
    await expect(shield).toHaveAttribute("aria-valuenow", "0");
    await expectAccessibleScreen(page, "the Trickster's duel");

    // Pedro's won challenge kept asking after his shield broke. It breaks at the fifth right
    // answer of six, and the duel ends there, won, the question left never asked.
    await playDuel(page, { until: CHECKPOINT_PASS_MARK - 1 });
    await expect(duelAside.getByText("2 questions left")).toBeVisible();

    await page.getByRole("radio", { name: "Right answer" }).click();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(shield).toHaveAttribute("aria-valuenow", String(CHECKPOINT_PASS_MARK));
    await expect(duelAside.getByText(/questions? left/u)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Next" })).toHaveCount(0);

    await expect(page.getByRole("status")).toHaveText(
      /^Correct!\s*His shield is broken\. You won!$/u,
    );

    await page.getByRole("button", { name: "See how it went" }).click();

    // The desktop result shows the outcome and answers, with rewards and the next phase beside it.
    await expect(
      page.getByRole("heading", { level: 1, name: "You beat the Trickster!" }),
    ).toBeVisible();

    await expect(
      page.getByText(`${CHECKPOINT_PASS_MARK} of ${CHECKPOINT_PASS_MARK} right`),
    ).toBeVisible();

    await expectAccessibleScreen(page, "a checkpoint's result");

    const details = page.getByRole("complementary", { name: "Phase 1 challenge" });
    await expect(details.getByText("Brain Power", { exact: true })).toBeVisible();
    await expect(details.getByText(/^\+[\d,]+$/u)).toBeVisible();
    await expect(details.getByText("Phase 1 complete")).toBeVisible();
    await expect(details.getByText("Trap hunter badge")).toBeVisible();

    await expect(details.getByRole("heading", { name: "Next phase" })).toBeVisible();
    await expect(details.getByText("Practice", { exact: true })).toBeVisible();

    const review = page.getByRole("region", { name: "The answers" });
    await expect(review.getByText("It follows the rule.")).toHaveCount(CHECKPOINT_PASS_MARK);

    await expect(review.getByText("Your answer", { exact: true })).toHaveCount(
      CHECKPOINT_PASS_MARK,
    );

    // On a phone, those answers wait in a sheet that Escape closes.
    await page.setViewportSize({ height: 720, width: 390 });
    await page.getByRole("button", { name: "Review the answers" }).click();
    const answers = page.getByRole("dialog", { name: "The answers" });
    await expect(answers.getByText("It follows the rule.")).toHaveCount(CHECKPOINT_PASS_MARK);
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
      page.getByText(`${CHECKPOINT_PASS_MARK} of ${CHECKPOINT_PASS_MARK} right`),
    ).toBeVisible();

    await expect(page.getByText(`${CHECKPOINT_PASS_MARK} right to win`)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Start" })).toHaveCount(0);

    await expect(page.getByRole("link", { name: "See how it went" })).toHaveAttribute(
      "href",
      `/checkpoint/${block.id}`,
    );

    // Reopened once every question is deleted, it keeps the score it earned.
    await prisma.item.deleteMany({ where: { id: { in: items.map((item) => item.id) } } });
    await page.goto(`/checkpoint/${block.id}`);

    await expect(
      page.getByRole("heading", { level: 1, name: "You beat the Trickster!" }),
    ).toBeVisible();

    await expect(
      page.getByText(`${CHECKPOINT_PASS_MARK} of ${CHECKPOINT_PASS_MARK} right`, { exact: true }),
    ).toBeVisible();

    await expect(page.getByText(/right to win/u)).toHaveCount(0);
    await expect(page.getByRole("link", { exact: true, name: "Continue" })).toBeVisible();

    await page.context().close();
  });

  // The mirror of a won duel: Pedro's lost challenge kept asking, still promising its prize. Core
  // counts the lessons a loss actually adds, none included (`rematch-reinforcement.test.ts`).
  test("a lost duel promises its actual reinforcement lessons and leaves the next phase open", async ({
    browser,
  }) => {
    const { block, boss, user } = await createCheckpointLearner({ reinforcementLessons: 2 });

    const page = await openAs(browser, user);

    await page.goto(`/challenge/${boss.id}`);
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page).toHaveURL(new RegExp(`/checkpoint/${block.id}$`, "u"));

    // Five right of six win it: one miss leaves them all to get.
    const duelAside = page.getByRole("complementary", { name: "Phase 1 challenge" });
    await playDuel(page, { answer: "Wrong answer", until: 1 });
    await expect(duelAside.getByText("5 questions left", { exact: true })).toBeVisible();
    await expect(duelAside.getByText("Winning", { exact: true })).toBeVisible();

    // The second miss decides it: nothing more is asked, or promised.
    await page.getByRole("radio", { name: "Wrong answer" }).click();
    await page.getByRole("button", { name: "Confirm" }).click();

    const verdict = page.getByRole("status");

    const rematch = "New try tomorrow, after 2 short lessons. Nothing is lost.";

    await expect(verdict).toContainText(rematch);
    await expect(page.getByRole("button", { name: "Next" })).toHaveCount(0);
    await expect(duelAside.getByText(/questions? left$/u)).toHaveCount(0);
    await expect(duelAside.getByText(/to go$/u)).toHaveCount(0);
    await expect(duelAside.getByText("Winning", { exact: true })).toHaveCount(0);

    await expect(verdict).toHaveText(`Not quiteHis shield held this time. ${rematch}`);

    // Reloaded before moving on, the duel stays over: it says how it ended, never a blank page.
    await page.reload();
    await expect(page.getByRole("status")).toContainText(rematch);
    await expect(page.getByRole("radio")).toHaveCount(0);

    await page.getByRole("button", { name: "See how it went" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Not this time" })).toBeVisible();
    await expect(page.getByText("0 of 2 right", { exact: true })).toBeVisible();

    // What winning took, of all six: "2 asked, 5 to win" alone would read as out of reach.
    await expect
      .soft(
        page
          .getByRole("main")
          .getByText(`${CHECKPOINT_PASS_MARK} of ${CHECKPOINT_QUESTIONS} right to win`),
      )
      .toBeVisible();

    // A new try, and the next phase named: nothing is locked.
    const details = page.getByRole("complementary", { name: "Phase 1 challenge" });
    await expect(details.getByText("New try tomorrow", { exact: true })).toBeVisible();

    await expect(
      details.getByText("After 2 short lessons on what tripped you up. Nothing is lost.", {
        exact: true,
      }),
    ).toBeVisible();

    await expect(details.getByText("The next phase, Practice, is already open.")).toBeVisible();
    await expect(page.getByText("Trap hunter badge")).toHaveCount(0);

    await expect.poll(() => planItemStatus(boss.id)).toBe("todo");

    // Its intro says so too, and opens how it went.
    await page.goto(`/challenge/${boss.id}`);

    await expect(page.getByText(rematch, { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "See how it went" }).click();
    await expect(page).toHaveURL(new RegExp(`/checkpoint/${block.id}$`, "u"));
    await expect(page.getByRole("heading", { level: 1, name: "Not this time" })).toBeVisible();
    await expect(details.getByText("New try tomorrow", { exact: true })).toBeVisible();

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

    // The mock's real clock is the same number the learner reserves in the plan.
    await expect(page.getByText(`${MOCK_MINUTES} min`, { exact: true })).toBeVisible();
    await expect(page.getByRole("main")).not.toContainText(`About ${MOCK_MINUTES} min`);

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
      page.getByRole("progressbar", { name: `Question 1 of ${THIN_CHECKPOINT.questions}` }),
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

    await expect(page.getByRole("progressbar", { name: "Question 1 of 6" })).toBeAttached();
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

    await expect(page.getByRole("progressbar", { name: "Question 1 of 6" })).toBeAttached();
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

    await page.getByRole("button", { name: /^Start session/u }).click();
    await expect(page).toHaveURL(new RegExp(`/challenge/${boss.id}\\?session=`, "u"));

    // One tap on Start opens the duel, never this intro again with a Continue to tap (the block's
    // page redirected Today's tap here, and the router kept that redirect for its address).
    await page.getByRole("button", { exact: true, name: "Start" }).click();

    await expect(
      page.getByRole("progressbar", { name: `Question 1 of ${CHECKPOINT_QUESTIONS}` }),
    ).toBeAttached();

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

      await expect(
        page.getByRole("progressbar", { name: `Question 1 of ${CHECKPOINT_QUESTIONS}` }),
      ).toBeAttached({ timeout: 1000 });
    }).toPass({ timeout: 5000 });

    await expect(page).toHaveURL(new RegExp(`/checkpoint/${block.id}\\?session=`, "u"));

    await playDuel(page, { keyboard: true, passMark: CHECKPOINT_PASS_MARK });

    // Enter leaves the single-screen result for the session.
    await expect(
      page.getByRole("heading", { level: 1, name: "You beat the Trickster!" }),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/session");
    await page.keyboard.press("Enter");

    // The checkpoint was the day's only block, so the session shows the day's summary.
    await expect(page).toHaveURL(/\/session$/u);
    // Winning the first checkpoint earned the Star glasses: their moment opens over the summary,
    // and Enter puts them on.
    const ceremony = page.getByRole("dialog", { name: "Star glasses!" });
    await expect(ceremony.getByRole("button", { name: "Wear them" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(ceremony).toBeHidden();
    await expect.poll(() => starShownAt(user.id)).not.toBeNull();

    // The step under it takes the focus, and Enter finishes the day.
    await expect(page.getByRole("heading", { level: 1, name: /^Done in /u })).toBeVisible();
    await expect(page.getByRole("link", { name: "Finish" })).toBeVisible();
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

/** The Monday after `date`'s day, as the moved challenge names it: "Monday, November 2". */
function nextMondayAfter(date: Date) {
  const monday = toUTCMidnight(date);
  monday.setUTCDate(monday.getUTCDate() + ((8 - monday.getUTCDay()) % 7 || 7));

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    weekday: "long",
  }).format(monday);
}

async function blockStatus(blockId: string) {
  const block = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } });
  return block.status;
}

test.describe("Move to Monday", () => {
  test("hides Move to Monday when Monday is a rest day", async ({ browser }) => {
    const { boss, plan, user } = await createCheckpointLearner({
      kind: "weekly",
      planned: true,
      weeklyKind: "checkpoint",
    });

    if (!isJsonObject(plan.settings) || !Array.isArray(plan.settings.weekdayMinutes)) {
      throw new Error("Expected the planned study week");
    }

    await prisma.plan.update({
      data: {
        settings: {
          ...plan.settings,
          weekdayMinutes: plan.settings.weekdayMinutes.map((minutes, weekday) =>
            weekday === 1 ? 0 : minutes,
          ),
        },
      },
      where: { id: plan.id },
    });

    const page = await openAs(browser, user);

    try {
      await page.goto(`/challenge/${boss.id}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("button", { name: "Move to Monday" })).toHaveCount(0);
    } finally {
      await page.context().close();
    }
  });

  test("an old challenge URL returns to Today after its plan item is replaced", async ({
    browser,
  }) => {
    const { boss, user } = await createCheckpointLearner({ kind: "weekly" });
    const page = await openAs(browser, user);

    try {
      await page.goto(`/challenge/${boss.id}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await prisma.planItem.delete({ where: { id: boss.id } });
      await page.reload();
      await expect(page).toHaveURL(/\/today$/u);
      await expect(page.getByRole("heading", { exact: true, name: "Today" })).toBeVisible();
    } finally {
      await page.context().close();
    }
  });

  test("the week's challenge moves to Monday through the plan, with undo", async ({ browser }) => {
    // A learn goal's week ends in its own checkpoint, which the plan moves without saving time.
    const { block, boss, plan, user } = await createCheckpointLearner({
      kind: "weekly",
      planned: true,
      weeklyKind: "checkpoint",
    });

    const page = await openAs(browser, user);

    // Opened from Today, so Back has a page to return to.
    await page.goto("/today");
    await page.goto(`/challenge/${boss.id}`);
    const move = page.getByRole("button", { name: "Move to Monday" });
    await expect(move).toBeVisible();
    await expectAccessibleScreen(page, "the week's challenge");
    await move.click();

    // It names the weekday "Move to Monday" promised, with the date: the Monday after today's.
    await expect(
      page.getByRole("heading", { name: `Moved to ${nextMondayAfter(new Date())}` }),
    ).toBeVisible();

    await expectAccessibleScreen(page, "the moved weekly challenge confirmation");

    await expect(
      page.getByText(
        "Your plan made room for it and moved any lessons that didn't fit. Nothing is lost.",
      ),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "Back to Today" })).toHaveAttribute(
      "href",
      "/today",
    );

    await expect.poll(() => blockStatus(block.id)).toBe("skipped");

    // A dated plan item is a new one on its new day: the page follows it.
    await expect(page).not.toHaveURL(new RegExp(boss.id, "u"));
    const days = await challengeDays(plan.id);
    expect(days.some((day) => day && new Date(`${day}T00:00:00Z`).getUTCDay() === 1)).toBe(true);

    await page.getByRole("button", { name: "Undo" }).click();

    await expect(page.getByRole("button", { name: "Move to Monday" })).toBeVisible();
    await expect(page).not.toHaveURL(/moved=/u);
    await expect.poll(() => blockStatus(block.id)).toBe("pending");

    // The move and its undo each replaced the page they left, whose plan item is gone, so Back
    // returns to Today instead of opening a challenge that no longer exists.
    await page.goBack();
    await expect(page).toHaveURL(/\/today$/u);

    await page.context().close();
  });
});
