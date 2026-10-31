import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { RENTING_SCENARIO } from "@zoonk/testing/fixtures/language";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { expect, test } from "./fixtures";
import { type StreamEvent } from "./generation-run";
import { createLanguageLearner } from "./language-learner";
import { openAs } from "./study-day";

const B1_SCORE = 2;

async function createB1Learner() {
  const learner = await createLanguageLearner({ withSubscription: true });
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

async function createUnwrittenCheckpoint() {
  const { checkpoints, goal, renting, user } = await createB1Learner();
  const [, boss] = checkpoints;
  const session = await studySessionFixture({ goalId: goal.id, userId: user.id });

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
      planItemId: boss?.id,
    },
    sessionId: session.id,
  });

  return { block, renting, user };
}

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

const RUN_EVENTS = "**/v1/generations/*/events**";
const RUN_STATUS = /\/v1\/generations\/[^/]+$/u;

function stream(events: StreamEvent[]) {
  return {
    body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
    contentType: "text/event-stream",
    status: 200,
  };
}

/** E2E runs wait on a model that never answers, so the test plays the run's end. */
async function playCallRuns(page: Page) {
  const run = { failing: true, written: Promise.withResolvers<null>() };

  await page.route(RUN_EVENTS, async (route) => {
    if (run.failing) {
      await route.fulfill(
        stream([{ reason: "aiGenerationFailed", status: "error", step: "workflowError" }]),
      );

      return;
    }

    await run.written.promise;

    await route.fulfill(
      stream([
        { status: "started", step: "writeCall" },
        { status: "completed", step: "callReady" },
      ]),
    );
  });

  await page.route(RUN_STATUS, (route) =>
    route.fulfill({ json: { status: run.failing ? "failed" : "completed" }, status: 200 }),
  );

  return run;
}

test.describe("Language calls written ahead", () => {
  test("a checkpoint whose call isn't written yet waits for it, can try again, then opens", async ({
    browser,
  }) => {
    const { block, renting, user } = await createUnwrittenCheckpoint();
    const page = await openAs(browser, user);
    const run = await playCallRuns(page);

    await page.goto(`/checkpoint/${block.id}`);
    await page.getByRole("button", { name: "Get the call ready" }).click();

    await expect(page.getByText("This didn't finish")).toBeVisible();

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toMatchObject({ startedAt: null, status: "pending" });

    run.failing = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("Getting your call ready")).toBeVisible();

    await writeB1Call(renting.id);
    run.written.resolve(null);

    await expect(page).toHaveURL(/\/conversation\//u);
    await expect(page.getByText(/^Linda · /u)).toBeVisible();

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toMatchObject({ status: "active" });

    await page.context().close();
  });
});
