import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { RENTING_SCENARIO } from "@zoonk/testing/fixtures/language";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { expect, test } from "./fixtures";
import { createLanguageLearner } from "./language-learner";
import { openAs } from "./study-day";

/** Speaking level B1 on the CEFR score scale (A1 is 0). */
const B1_SCORE = 2;

const IELTS_SCENARIO = {
  ...RENTING_SCENARIO,
  character: { name: "Emma", place: "Test centre", role: "examinadora" },
  exam: "ielts",
  title: "Simulado de Speaking do IELTS",
};

/** A Focus language learner speaking at B1, while the renting unit's call is only written at A2. */
async function createB1Learner() {
  const learner = await createLanguageLearner("focus");
  const { user } = learner;

  await prisma.languageSkillLevel.create({
    data: {
      language: "en",
      score: B1_SCORE,
      skill: "speaking",
      startScore: B1_SCORE,
      userId: user.id,
    },
  });

  return learner;
}

/**
 * A B1 learner whose renting unit's boss is in today's session: the unit's call is only written
 * at A2, so the checkpoint's call isn't written.
 */
async function createUnwrittenCheckpoint() {
  const { goal, plan, renting, user } = await createB1Learner();

  const [boss, session] = await Promise.all([
    planItemFixture({ kind: "boss", phase: 1, planId: plan.id, position: 10 }),
    studySessionFixture({ goalId: goal.id, userId: user.id }),
  ]);

  const block = await studySessionBlockFixture({
    kind: "checkpoint",
    payload: {
      checkpoint: {
        kind: "boss",
        mock: false,
        passMark: 0,
        phase: 1,
        rematch: false,
        timeLimitMinutes: null,
      },
      planItemId: boss.id,
    },
    sessionId: session.id,
  });

  return { block, renting, user };
}

/** The unit's call written at B1, as a session's preparation writes it. */
async function writeB1Call(chapterId: string) {
  await prisma.conversationScenario.create({
    data: {
      chapterId,
      content: RENTING_SCENARIO,
      level: "B1",
      model: "test",
      promptVersion: "test",
      runId: "test",
    },
  });
}

/**
 * The goal names the IELTS, so Progress offers its speaking mock; with no speaking level yet, the
 * goal's A2 is the level its examiner speaks at.
 */
async function ieltsGoal(goalId: string) {
  await prisma.goal.update({
    data: { details: { level: "A2", reason: "Vou fazer o IELTS em março", targetLevel: "B1+" } },
    where: { id: goalId },
  });
}

/** The goal's next IELTS mock, written ahead at its A2 and not opened yet. */
async function waitingMockFixture({ goalId, userId }: { goalId: string; userId: string }) {
  return prisma.languageConversation.create({
    data: {
      goalId,
      kind: "speakingMock",
      language: "pt",
      level: "A2",
      liveModel: "openai/gpt-live-1",
      minutes: 5,
      scenario: IELTS_SCENARIO,
      targetLanguage: "en",
      titleSnapshot: IELTS_SCENARIO.title,
      userId,
    },
  });
}

/**
 * Writing a call takes a model about half a minute, and tests never call one: holding the start's
 * request until `release` keeps the start as slow as a real write, so the wait shows. Once
 * released, the start reaches the server as usual (where writing fails, since no model runs).
 */
async function holdServerActions(page: Page) {
  const { promise, resolve } = Promise.withResolvers<null>();

  await page.route("**/*", async (route) => {
    const request = route.request();

    if (request.method() === "POST" && request.headers()["next-action"]) {
      await promise;
    }

    await route.fallback();
  });

  return () => resolve(null);
}

test.describe("Language calls written ahead", () => {
  test("a checkpoint whose call isn't written yet writes it when the learner asks, then opens it at once", async ({
    browser,
  }) => {
    const { block, renting, user } = await createUnwrittenCheckpoint();
    const page = await openAs(browser, user);

    await page.goto(`/checkpoint/${block.id}`);

    await expect(page.getByText("Unit checkpoint")).toBeVisible();

    await expect(page.getByRole("heading", { level: 1, name: renting.title })).toBeVisible();

    // Opening the checkpoint writes nothing: the call waits for the learner's tap.
    await expect(
      prisma.languageConversation.count({ where: { studyBlockId: block.id } }),
    ).resolves.toBe(0);

    await page.getByRole("button", { name: "Get the call ready" }).click();

    // No model writes in tests, so this call can't be written, and the wait says so.
    await expect(page.getByText("This didn't start")).toBeVisible();

    // Meanwhile the unit's call is written, as a session's preparation writes it: trying
    // again opens the call.
    await writeB1Call(renting.id);
    await page.getByRole("button", { name: "Try again" }).click();

    await expect(page).toHaveURL(/\/conversation\//u);
    await expect(page.getByRole("heading", { level: 1, name: "Linda" })).toBeVisible();

    // Once written, the checkpoint opens the unit's call straight away.
    await page.goto(`/checkpoint/${block.id}`);

    await expect(page).toHaveURL(/\/conversation\//u);
    await expect(page.getByText("Unit checkpoint")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Linda" })).toBeVisible();
    await page.context().close();
  });

  test("a speaking mock that isn't written yet shows it being written", async ({ browser }) => {
    const { goal, user } = await createLanguageLearner("fun");
    await ieltsGoal(goal.id);

    const page = await openAs(browser, user);
    await page.goto("/progress");

    const card = page.getByRole("region", { name: "IELTS speaking mock" });
    const release = await holdServerActions(page);
    await card.getByRole("button", { name: "Start the mock" }).click();

    await expect(card.getByRole("progressbar", { name: "Writing your mock" })).toBeVisible();

    await expect(
      card
        .getByRole("list", { name: "Writing your mock" })
        .getByText("Writing the examiner's script"),
    ).toBeVisible();

    await expect(card.getByText("Your mock opens as soon as it's ready.")).toBeVisible();

    release();

    // No model writes in tests, so this mock can't be written, and the wait says so.
    await expect(card.getByText("This didn't start")).toBeVisible();

    // Meanwhile the next mock is written ahead, as a session's preparation writes it: trying
    // again opens it.
    const waiting = await waitingMockFixture({ goalId: goal.id, userId: user.id });
    await card.getByRole("button", { name: "Try again" }).click();

    await expect(page).toHaveURL(new RegExp(`/conversation/${waiting.id}$`, "u"));
    await expect(page.getByRole("heading", { level: 1, name: "Emma" })).toBeVisible();
    await page.context().close();
  });

  test("a unit's practice call that isn't written at the learner's level shows it being written", async ({
    browser,
  }) => {
    const { renting, user } = await createB1Learner();
    const page = await openAs(browser, user);
    await page.goto(`/content/units/${renting.id}`);

    const call = page.getByRole("region", { name: "Practice a conversation" });
    const release = await holdServerActions(page);
    await call.getByRole("button", { name: "Start the call" }).click();

    await expect(call.getByRole("progressbar", { name: "Writing your call" })).toBeVisible();

    await expect(
      call
        .getByRole("list", { name: "Writing your call" })
        .getByText("Writing the call for your level"),
    ).toBeVisible();

    release();

    await expect(call.getByText("This didn't start")).toBeVisible();

    await writeB1Call(renting.id);
    await call.getByRole("button", { name: "Try again" }).click();

    await expect(page).toHaveURL(/\/conversation\//u);
    await expect(page.getByRole("heading", { level: 1, name: "Linda" })).toBeVisible();
    await page.context().close();
  });
});
