import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { listeningContent, listeningSetFixture } from "@zoonk/testing/fixtures/listening";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { expect, test } from "./fixtures";
import { RECORDING_MS, toneUrl } from "./listening-audio";
import { openAs } from "./study-day";

/** The listening section's two recordings, each played once with two questions on it. */
const PARTS = [
  "Part 1: a conversation between two people in an everyday social context",
  "Part 2: one speaker talking about local facilities",
];

const READING_QUESTIONS = 3;

/**
 * An IELTS-like learner on Plus: a listening section of two voiced recordings (two questions
 * each, played once), then a reading section the bank holds every question of.
 */
async function createListeningMockLearner() {
  const unique = randomUUID();

  const [user, blueprint, listening, reading] = await Promise.all([
    createE2EUser(getBaseURL()),
    examBlueprintFixture({
      language: "en",
      name: `IELTS ${unique}`,
      structure: {
        formats: [],
        mock: {
          adaptive: false,
          citations: [],
          order: null,
          scoring: { description: "Bands", method: "scaled" },
          sections: [
            {
              day: null,
              kind: "listening",
              minutes: 10,
              name: "Listening",
              questions: 4,
              tasks: PARTS.map((description) => ({ count: 2, description, plays: 1 })),
            },
            {
              day: null,
              kind: "objective",
              minutes: 6,
              name: "Reading",
              questions: READING_QUESTIONS,
              tasks: [],
            },
          ],
          timeLimitMinutes: null,
          totalQuestions: 4 + READING_QUESTIONS,
        },
        rules: [],
        subjects: [],
      },
    }),
    skillFixture({ name: `Note details heard ${unique}` }),
    skillFixture({ name: `Read for gist ${unique}` }),
  ]);

  const goal = await goalFixture({
    examBlueprintId: blueprint.id,
    kind: "exam",
    targetLanguage: "en",
    timezone: "UTC",
    title: "IELTS",
    userId: user.id,
  });

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Base" }],
      skills: [
        { area: "Listening", skill: listening },
        { area: "Reading", skill: reading },
      ].map(({ area, skill }) => ({
        area,
        lessons: 1,
        name: skill.name,
        phase: 0,
        skillId: skill.id,
        weight: null,
      })),
    },
  });

  const recordings = await Promise.all(
    PARTS.map(async (task) => {
      const audio = await mediaAssetFixture({
        durationMs: RECORDING_MS,
        kind: "audio",
        url: toneUrl(RECORDING_MS / 1000),
      });

      return listeningSetFixture({
        content: { ...listeningContent({ plays: 1 }), task },
        examBlueprintId: blueprint.id,
        mediaAssetId: audio.id,
      });
    }),
  );

  await Promise.all([
    ...recordings.flatMap((recording, part) =>
      [0, 1].map((setPosition) =>
        itemFixture({
          content: choiceItemContent(
            `Part ${part + 1}, question ${setPosition + 1}: what was said?`,
          ),
          examBlueprintId: blueprint.id,
          setId: recording.id,
          setPosition,
          skillId: listening.id,
        }),
      ),
    ),
    ...Array.from({ length: READING_QUESTIONS }, (_, index) =>
      itemFixture({
        content: choiceItemContent(`Reading question ${index + 1}?`),
        examBlueprintId: blueprint.id,
        skillId: reading.id,
      }),
    ),
    planItemFixture({ kind: "lesson", planId: plan.id, position: 0, skillId: reading.id }),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    }),
  ]);

  return { user };
}

test.describe("Mock listening sections", () => {
  test("plays each recording once above its questions, keeps it playing between them, counts it on any device, and shows what was said in the review", async ({
    browser,
  }) => {
    const { user } = await createListeningMockLearner();
    const page = await openAs(browser, user);
    const recording = page.getByRole("region", { exact: true, name: "Recording" });

    // The full mock asks the listening section: it's not among what mocks leave out.
    await page.goto("/mock/new");
    await expect(page.getByRole("radio", { name: /^A full exam day\b.*7 q/u })).toBeVisible();
    await expect(page.getByText(/isn't in mocks yet/u)).toBeHidden();
    await page.getByRole("button", { name: "Start" }).click();

    await expect(page.getByText("Question 1 of 2 on this recording")).toBeVisible();
    await expect(recording.getByText(/You hear it once, like in the exam/u)).toBeVisible();

    // Every play counts, as in the exam: the recording keeps playing while the learner moves on.
    await recording.getByRole("button", { name: "Play the recording" }).click();
    await expect(recording.getByText("Playing. It doesn't pause, like in the exam.")).toBeVisible();
    await page.getByRole("radio").first().click();
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByText("Question 2 of 2 on this recording")).toBeVisible();
    await expect(recording.getByText("Playing. It doesn't pause, like in the exam.")).toBeVisible();

    await expect(recording.getByText(/You've used every play/u)).toBeVisible({
      timeout: RECORDING_MS * 2,
    });

    await expect(recording.getByRole("button", { name: "Play it again" })).toBeDisabled();

    // The mock keeps the count: another device opening it, where the learner stopped, has no play
    // left either.
    const other = await openAs(browser, user);
    await other.goto(page.url());
    const otherRecording = other.getByRole("region", { exact: true, name: "Recording" });
    await expect(other.getByText("Question 2 of 2 on this recording")).toBeVisible();
    await expect(otherRecording.getByText(/You've used every play/u)).toBeVisible();
    await expect(otherRecording.getByRole("button", { name: "Play it again" })).toBeDisabled();
    await other.context().close();

    // The next part's recording starts with its own play.
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Question 1 of 2 on this recording")).toBeVisible();
    await expect(recording.getByRole("button", { name: "Play the recording" })).toBeEnabled();

    const sheet = page.getByRole("complementary", { name: "Answer sheet" });
    await sheet.getByRole("button", { exact: true, name: "Hand in" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Hand in" }).click();

    await expect(page.getByText(/^Question 5 of 7 · Reading/u)).toBeVisible();
    await sheet.getByRole("button", { exact: true, name: "Hand in" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Hand in" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /^Mock exam 1 done/u })).toBeVisible();

    const review = page.getByRole("region", { name: "Questions to review" });
    const transcript = review.getByRole("region", { name: "Transcript" }).first();

    await transcript.getByRole("button", { name: "Transcript" }).click();
    await expect(transcript.getByText("Tuesday, no, sorry, Thursday the twelfth.")).toBeVisible();
  });
});
