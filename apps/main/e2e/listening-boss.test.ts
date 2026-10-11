import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { listeningContent, listeningSetFixture } from "@zoonk/testing/fixtures/listening";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { createGoalLearner } from "./checkpoint-fixtures";
import { expect, test } from "./fixtures";
import { RECORDING_MS, toneUrl } from "./listening-audio";
import { continueToLastStep } from "./result-steps";
import { openAs } from "./study-day";

/** Four choices on the booking call, then the day it ends on, typed as the exam's form asks. */
const CHOICES = ["The small hall", "Ten chairs", "Two hours", "By card"].map((right, index) => ({
  context: null,
  options: [
    { isCorrect: true, misconception: null, reason: "Tom says it.", text: right },
    {
      isCorrect: false,
      misconception: "Picks a word heard but corrected",
      reason: "Tom corrects himself.",
      text: `Not this ${index + 1}`,
    },
  ],
  question: `Booking detail ${index + 1}?`,
}));

const DAY_GAP = {
  acceptedAnswers: ["Thursday"],
  context: null,
  keyPoints: ["The day Tom settles on"],
  question: "Day of the booking: ______",
  sampleAnswer: "Thursday",
};

const PASS_MARK = 4;

/**
 * An IELTS learner whose day holds the Listening phase's boss: a voiced recording played once,
 * with its five questions (four choices and a typed gap) as the duel.
 */
async function createListeningBoss() {
  const [{ goal, user }, skill, audio] = await Promise.all([
    createGoalLearner(),
    skillFixture({ name: `Note details heard ${randomUUID()}` }),
    mediaAssetFixture({
      durationMs: RECORDING_MS,
      kind: "audio",
      url: toneUrl(RECORDING_MS / 1000),
    }),
  ]);

  const [plan, recording] = await Promise.all([
    planFixture({ goalId: goal.id, phases: [{ name: "Listening" }, { name: "Reading" }] }),
    listeningSetFixture({ content: listeningContent({ plays: 1 }), mediaAssetId: audio.id }),
  ]);

  const [items, boss, session] = await Promise.all([
    Promise.all(
      [...CHOICES, DAY_GAP].map((content, setPosition) =>
        itemFixture({
          content,
          format: content === DAY_GAP ? "typed" : "multipleChoice",
          setId: recording.id,
          setPosition,
          skillId: skill.id,
        }),
      ),
    ),
    planItemFixture({
      kind: "boss",
      phase: 0,
      planId: plan.id,
      position: 0,
      titleSnapshot: "Listening boss",
    }),
    studySessionFixture({ goalId: goal.id, userId: user.id }),
  ]);

  const block = await studySessionBlockFixture({
    estimatedMinutes: 8,
    kind: "checkpoint",
    payload: {
      checkpoint: {
        kind: "boss",
        mock: false,
        passMark: PASS_MARK,
        phase: 0,
        rematch: false,
        timeLimitMinutes: null,
      },
      itemIds: items.map((item) => item.id),
      planItemId: boss.id,
      skillIds: [skill.id],
      title: "Listening boss",
    },
    position: 0,
    sessionId: session.id,
  });

  return { block, boss, itemIds: items.map((item) => item.id), user };
}

test.describe("A Listening phase's boss", () => {
  test("plays its recording once, like a mock, takes typed answers, and shows the transcript in the review", async ({
    browser,
  }) => {
    const { block, boss, itemIds, user } = await createListeningBoss();
    const page = await openAs(browser, user);
    const recording = page.getByRole("region", { exact: true, name: "Recording" });
    const questionsButton = page.getByRole("button", { name: "Questions on this recording (5)" });

    await page.goto(`/checkpoint/${block.id}`);
    await expect(page).toHaveURL(new RegExp(`/challenge/${boss.id}$`, "u"));

    // Its intro says the questions are on a recording, played as the exam plays it.
    await expect(
      page.getByText(
        "Questions on a recording from this phase, played as in the exam, with no hints.",
      ),
    ).toBeVisible();

    await page.getByRole("button", { name: "Start" }).click();
    await expect(page).toHaveURL(new RegExp(`/checkpoint/${block.id}$`, "u"));

    // The recording sits above the duel's questions, which the learner reads before it plays.
    await expect(page.getByText("Question 1 of 5 on this recording")).toBeVisible();
    await expect(recording.getByText(/You hear it once, like in the exam/u)).toBeVisible();
    await expect(questionsButton).toHaveAttribute("aria-expanded", "true");

    await recording.getByRole("button", { name: "Play the recording" }).click();
    await expect(recording.getByText("Playing. It doesn't pause, like in the exam.")).toBeVisible();
    await expect(questionsButton).toHaveAttribute("aria-expanded", "false");

    // Strict like a mock: a reload mid-play uses the play, with no second chance.
    await page.reload();
    await expect(recording.getByText(/You've used every play/u)).toBeVisible();
    await expect(recording.getByRole("button", { name: "Play it again" })).toBeDisabled();
    await expect(recording.getByText(/so you can play it once more/u)).toBeHidden();
    await expect(questionsButton).toHaveAttribute("aria-expanded", "false");

    for (const [index, { options }] of CHOICES.entries()) {
      // oxlint-disable-next-line no-await-in-loop -- A duel is answered one question at a time.
      await expect(page.getByText(`Question ${index + 1} of 5 on this recording`)).toBeVisible();
      // oxlint-disable-next-line no-await-in-loop -- A duel is answered one question at a time.
      await page.getByRole("radio", { name: options[0]?.text }).click();
      // oxlint-disable-next-line no-await-in-loop -- A duel is answered one question at a time.
      await page.getByRole("button", { name: "Confirm" }).click();
      // oxlint-disable-next-line no-await-in-loop -- A duel is answered one question at a time.
      await expect(page.getByText("Right!")).toBeVisible();
      // oxlint-disable-next-line no-await-in-loop -- A duel is answered one question at a time.
      await page.getByRole("button", { name: "Next" }).click();
    }

    // The form's gap is typed, as the exam asks it; Enter confirms.
    await expect(page.getByText("Day of the booking: ______")).toBeVisible();
    await page.getByRole("textbox", { name: "Your answer" }).fill("thursday");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Right!")).toBeVisible();

    // Its last question answered, the recording plays freely, with what was said.
    await expect(recording.getByText("Listen again as often as you like.")).toBeVisible();

    await page.getByRole("button", { name: "See how it went" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "You beat the Trickster!" }),
    ).toBeVisible();

    // The answers wait behind a link on the result's last step.
    await continueToLastStep(page);
    await page.getByRole("button", { name: "Review the answers" }).click();
    const answers = page.getByRole("dialog", { name: "The answers" });
    await answers.getByRole("button", { name: "Transcript" }).click();
    await expect(answers.getByText("Tuesday, no, sorry, Thursday the twelfth.")).toBeVisible();
    await expect(answers.getByRole("button", { name: "Play it again" })).toBeEnabled();

    const attempts = await prisma.attempt.findMany({ where: { itemId: { in: itemIds } } });
    expect(attempts.filter((attempt) => attempt.isCorrect)).toHaveLength(5);

    await page.context().close();
  });
});
