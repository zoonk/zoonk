import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { listeningContent, listeningSetFixture } from "@zoonk/testing/fixtures/listening";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { expect, test } from "./fixtures";
import { RECORDING_MS, toneUrl } from "./listening-audio";
import { openAs } from "./study-day";

/** Two questions on the booking call, in the order the recording answers them. */
const QUESTIONS = [
  {
    options: [
      { isCorrect: true, text: "The small hall" },
      { isCorrect: false, text: "The swimming pool" },
    ],
    question: "Hall: what does Tom want to book?",
  },
  {
    options: [
      { isCorrect: true, text: "Thursday" },
      { isCorrect: false, text: "Tuesday" },
    ],
    question: "Day: which day does Tom book in the end?",
  },
].map(({ options, question }) => ({
  context: null,
  options: options.map((option) => ({
    ...option,
    misconception: option.isCorrect ? null : "Picks a word heard but corrected",
    reason: option.isCorrect ? "Tom says it." : "Tom corrects himself.",
  })),
  question,
}));

/**
 * An IELTS learner whose day is one practice block asking a voiced recording's two questions,
 * played once like the exam's first part.
 */
async function createListeningDay() {
  const [user, skill, lesson, audio] = await Promise.all([
    createE2EUser(getBaseURL()),
    skillFixture({ name: `Note details heard ${randomUUID()}` }),
    libraryLessonFixture({ title: "Listening for details" }),
    mediaAssetFixture({
      durationMs: RECORDING_MS,
      kind: "audio",
      url: toneUrl(RECORDING_MS / 1000),
    }),
  ]);

  const goal = await goalFixture({
    kind: "exam",
    targetLanguage: "en",
    timezone: "UTC",
    title: "IELTS",
    userId: user.id,
  });

  const [plan, recording] = await Promise.all([
    planFixture({ goalId: goal.id }),
    listeningSetFixture({ content: listeningContent({ plays: 1 }), mediaAssetId: audio.id }),
  ]);

  const [items, session] = await Promise.all([
    Promise.all(
      QUESTIONS.map((content, setPosition) =>
        itemFixture({ content, setId: recording.id, setPosition, skillId: skill.id }),
      ),
    ),
    studySessionFixture({ goalId: goal.id, userId: user.id }),
    planItemFixture({ kind: "lesson", lessonId: lesson.id, planId: plan.id, position: 0 }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  await studySessionBlockFixture({
    estimatedMinutes: 4,
    kind: "practice",
    payload: { itemIds: items.map((item) => item.id), skillIds: [skill.id] },
    position: 0,
    sessionId: session.id,
  });

  return { itemIds: items.map((item) => item.id), user };
}

test.describe("Exam listening in practice", () => {
  test("plays a recording once, like the exam, restarts it once after a reload, and shows its transcript after its last question", async ({
    browser,
  }) => {
    const { itemIds, user } = await createListeningDay();
    const page = await openAs(browser, user);
    const feedback = page.getByRole("region", { name: "Answer feedback" });
    const recording = page.getByRole("region", { exact: true, name: "Recording" });
    await page.goto("/session");
    await page.getByRole("button", { name: /^Start/u }).click();

    // The first question says it's on a recording, which part of the exam it stands for, that it
    // plays once, and lists the recording's questions to read before it plays.
    await expect(page.getByText("Question 1 of 2 on this recording")).toBeVisible();
    await expect(page.getByText(/^Part 1: a conversation between two people/u)).toBeVisible();
    await expect(recording.getByText(/You hear it once, like in the exam/u)).toBeVisible();

    const questionsButton = page.getByRole("button", { name: "Questions on this recording (2)" });
    await expect(questionsButton).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("listitem").filter({ hasText: "Day: which day" })).toBeVisible();

    // Playing folds the list, so the question on screen stays in view.
    await recording.getByRole("button", { name: "Play the recording" }).click();
    await expect(recording.getByText("Playing. It doesn't pause, like in the exam.")).toBeVisible();
    await expect(questionsButton).toHaveAttribute("aria-expanded", "false");

    // Practice gives back a play a reload cuts off, once, and says so.
    await page.reload();

    await expect(
      recording.getByText(
        "The recording stopped before the end, so you can play it once more from the start.",
      ),
    ).toBeVisible();

    // The play given back comes with the questions to read again first.
    await expect(questionsButton).toHaveAttribute("aria-expanded", "true");

    await recording.getByRole("button", { name: "Play the recording" }).click();
    await expect(recording.getByText("Playing. It doesn't pause, like in the exam.")).toBeVisible();

    // The learner answers along: the recording keeps playing through the feedback and the next
    // question, as in the exam.
    await page.getByRole("button", { name: "The small hall" }).click();
    await expect(feedback.getByText("Correct!")).toBeVisible();
    await expect(page.getByRole("region", { name: "Transcript" })).toBeHidden();
    await page.getByRole("button", { name: /^Continue/u }).click();

    await expect(page.getByText("Question 2 of 2 on this recording")).toBeVisible();
    await expect(recording.getByText("Playing. It doesn't pause, like in the exam.")).toBeVisible();

    // Once it ends, it can't be played again until the questions are answered, even after a reload.
    await expect(recording.getByText(/You've used every play/u)).toBeVisible({
      timeout: RECORDING_MS * 2,
    });

    await expect(recording.getByRole("button", { name: "Play it again" })).toBeDisabled();
    await page.reload();
    await expect(page.getByRole("heading", { name: /^Day: which day/u })).toBeVisible();
    await expect(recording.getByRole("button", { name: "Play it again" })).toBeDisabled();

    // Heard already: the questions stay folded, so the one on screen stays in view.
    await expect(questionsButton).toHaveAttribute("aria-expanded", "false");

    // The last answer brings the transcript and free replays.
    await page.getByRole("button", { name: "Thursday" }).click();
    await expect(feedback.getByText("Correct!")).toBeVisible();

    const transcript = page.getByRole("region", { name: "Transcript" });
    await transcript.getByRole("button", { name: "Transcript" }).click();
    await expect(transcript.getByText("Tuesday, no, sorry, Thursday the twelfth.")).toBeVisible();
    await expect(recording.getByText("Listen again as often as you like.")).toBeVisible();
    await expect(recording.getByRole("button", { name: "Play it again" })).toBeEnabled();

    const attempts = await prisma.attempt.findMany({ where: { itemId: { in: itemIds } } });
    expect(attempts.filter((attempt) => attempt.isCorrect)).toHaveLength(2);

    await page.context().close();
  });
});
