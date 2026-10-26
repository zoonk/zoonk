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

const B1_SCORE = 2;

/** A language learner speaking at B1, while the renting unit's call is only written at A2. */
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

test.describe("Language calls written ahead", () => {
  test("a checkpoint whose call isn't written yet writes it when the learner asks, then opens it at once", async ({
    browser,
  }) => {
    const { block, renting, user } = await createUnwrittenCheckpoint();
    const page = await openAs(browser, user);

    await page.goto(`/checkpoint/${block.id}`);

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
    await expect(page.getByText(/^Linda · /u)).toBeVisible();

    await page.context().close();
  });
});
