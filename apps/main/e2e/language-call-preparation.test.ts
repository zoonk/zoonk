import { prisma } from "@zoonk/db";
import { RENTING_SCENARIO } from "@zoonk/testing/fixtures/language";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { expect, test } from "./fixtures";
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

test.describe("Language calls written ahead", () => {
  test("a checkpoint whose call isn't written yet writes it when the learner asks, then opens it at once", async ({
    browser,
  }) => {
    const { block, renting, user } = await createUnwrittenCheckpoint();
    const page = await openAs(browser, user);

    await page.goto(`/checkpoint/${block.id}`);

    await expect(
      prisma.languageConversation.count({ where: { studyBlockId: block.id } }),
    ).resolves.toBe(0);

    await page.getByRole("button", { name: "Get the call ready" }).click();

    // E2E blocks the writing model, so this call can't be written.
    await expect(page.getByText("This didn't start")).toBeVisible();

    await writeB1Call(renting.id);
    await page.getByRole("button", { name: "Try again" }).click();

    await expect(page).toHaveURL(/\/conversation\//u);
    await expect(page.getByText(/^Linda · /u)).toBeVisible();

    await page.context().close();
  });
});
