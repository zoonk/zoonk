import { randomUUID } from "node:crypto";
import { type Page } from "@playwright/test";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { lessonSentenceFixture, sentenceFixture } from "@zoonk/testing/fixtures/sentences";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { lessonWordFixture, wordFixture } from "@zoonk/testing/fixtures/words";
import { expect, test } from "./fixtures";

async function createReviewActivity(options: {
  sentences: { sentence: string; translation: string }[];
  words: { translation: string; word: string }[];
}) {
  const org = await getAiOrganization();

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-review-course-${uniqueId}`,
    title: `E2E Review Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-review-chapter-${uniqueId}`,
    title: `E2E Review Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `E2E review lesson ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-review-lesson-${uniqueId}`,
    title: `E2E Review Lesson ${uniqueId}`,
  });

  const [createdWords, createdSentences] = await Promise.all([
    Promise.all(
      options.words.map(async (wordData) => {
        const word = await wordFixture({
          organizationId: org.id,
          word: wordData.word,
        });

        await lessonWordFixture({
          lessonId: lesson.id,
          translation: wordData.translation,
          wordId: word.id,
        });

        return word;
      }),
    ),
    Promise.all(
      options.sentences.map(async (sentenceData) => {
        const sentence = await sentenceFixture({
          organizationId: org.id,
          sentence: sentenceData.sentence,
        });

        await lessonSentenceFixture({
          lessonId: lesson.id,
          sentenceId: sentence.id,
          translation: sentenceData.translation,
        });

        return sentence;
      }),
    ),
  ]);

  // Create a source activity (vocabulary) with interactive steps
  const sourceActivity = await activityFixture({
    generationStatus: "completed",
    isPublished: true,
    kind: "translation",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
    title: `E2E Source Activity ${uniqueId}`,
  });

  const vocabStepCount = createdWords.length;

  await Promise.all([
    ...createdWords.map((word, index) =>
      stepFixture({
        activityId: sourceActivity.id,
        content: {},
        isPublished: true,
        kind: "translation",
        position: index,
        wordId: word.id,
      }),
    ),
    ...createdSentences.map((sentence, index) =>
      stepFixture({
        activityId: sourceActivity.id,
        content: {},
        isPublished: true,
        kind: "reading",
        position: vocabStepCount + index,
        sentenceId: sentence.id,
      }),
    ),
  ]);

  // Create the review activity (completed at creation time, no pre-generated steps)
  // Create a third activity so the review one is not the last in the lesson.
  // This ensures tests see mid-lesson completion behavior (not lesson-complete).
  await Promise.all([
    activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "review",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 1,
      title: `E2E Review Activity ${uniqueId}`,
    }),
    activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 2,
    }),
  ]);

  const url = `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/1`;

  return { url };
}

/**
 * Completes a vocab step by reading the displayed translation and selecting
 * the matching word from the radio options.
 */
async function completeVocabStep(
  page: Page,
  translationToWord: Record<string, string>,
): Promise<void> {
  const radiogroup = page.getByRole("radiogroup", { name: /answer options/i });
  await expect(radiogroup).toBeVisible();

  // Read the displayed translation from the prompt text
  const promptText = await page
    .getByText(/translate this word/i)
    .locator("..")
    .textContent();
  const correctWord = Object.entries(translationToWord).find(([translation]) =>
    promptText?.includes(translation),
  )?.[1];

  if (!correctWord) {
    throw new Error(`Could not find matching word for prompt: ${promptText}`);
  }

  await expect(async () => {
    const option = radiogroup.getByRole("radio", { name: correctWord });
    const isChecked = await option.getAttribute("aria-checked");

    if (isChecked !== "true") {
      await option.click();
    }

    await expect(option).toHaveAttribute("aria-checked", "true", {
      timeout: 1000,
    });
  }).toPass();

  await page.getByRole("button", { name: /check/i }).click();
  await page.getByRole("button", { name: /continue/i }).click();
}

/**
 * Completes a reading step by tapping words in the word bank.
 */
async function completeReadingStep(page: Page, word1: string, word2: string): Promise<void> {
  const wordBank = page.getByRole("group", { name: /word bank/i });
  await expect(wordBank).toBeVisible();

  await wordBank.getByRole("button", { exact: true, name: word1 }).click();
  await wordBank.getByRole("button", { exact: true, name: word2 }).click();

  await page.getByRole("button", { name: /check/i }).click();
  await page.getByRole("button", { name: /continue/i }).click();
}

/**
 * Review screens can briefly be between interactive states while the player swaps
 * feedback, the next step, and the completion screen. Polling the visible screen
 * keeps the test aligned with the real UI instead of assuming answer controls are
 * always the first stable element to appear.
 */
async function getVisibleReviewState({
  completionScoreText,
  page,
}: {
  completionScoreText: string;
  page: Page;
}): Promise<"completed" | "pending" | "reading" | "vocab"> {
  if (await page.getByText(/translate this word/i).isVisible()) {
    return "vocab";
  }

  if (await page.getByText(/translate this sentence/i).isVisible()) {
    return "reading";
  }

  if (await page.getByText(completionScoreText, { exact: true }).isVisible()) {
    return "completed";
  }

  return "pending";
}

/**
 * `expect.poll()` only tells us that a state became visible at least once.
 * Returning the state from the successful poll avoids a second read that can
 * land in the middle of the same transition we just waited through.
 */
async function waitForVisibleReviewState({
  completionScoreText,
  page,
}: {
  completionScoreText: string;
  page: Page;
}): Promise<"completed" | "reading" | "vocab"> {
  let reviewState: "completed" | "pending" | "reading" | "vocab" = "pending";

  await expect(async () => {
    reviewState = await getVisibleReviewState({ completionScoreText, page });
    expect(reviewState).not.toBe("pending");
  }).toPass({ timeout: 10_000 });

  if (reviewState === "pending") {
    throw new Error("Expected review state to be visible");
  }

  return reviewState;
}

/**
 * Completes a single step in the review. Steps are shuffled, so we wait for the
 * current visible screen and handle that state directly.
 */
async function completeAnyStep(
  completionScoreText: string,
  page: Page,
  translationToWord: Record<string, string>,
  sentenceWord1: string,
  sentenceWord2: string,
): Promise<boolean> {
  const reviewState = await waitForVisibleReviewState({ completionScoreText, page });

  if (reviewState === "completed") {
    return false;
  }

  if (reviewState === "vocab") {
    await completeVocabStep(page, translationToWord);
    return true;
  }

  if (reviewState === "reading") {
    await completeReadingStep(page, sentenceWord1, sentenceWord2);
    return true;
  }

  throw new Error("Unexpected review state");
}

/**
 * Review steps are sequential: each answer changes which screen appears next.
 * Recursing through the remaining count keeps that one-at-a-time flow explicit
 * without relying on an `await` loop.
 */
async function completeRemainingReviewSteps({
  completionScoreText,
  page,
  remainingStepCount,
  sentenceWord1,
  sentenceWord2,
  translationToWord,
}: {
  completionScoreText: string;
  page: Page;
  remainingStepCount: number;
  sentenceWord1: string;
  sentenceWord2: string;
  translationToWord: Record<string, string>;
}): Promise<void> {
  if (remainingStepCount === 0) {
    return;
  }

  const completedStep = await completeAnyStep(
    completionScoreText,
    page,
    translationToWord,
    sentenceWord1,
    sentenceWord2,
  );

  if (!completedStep) {
    return;
  }

  await completeRemainingReviewSteps({
    completionScoreText,
    page,
    remainingStepCount: remainingStepCount - 1,
    sentenceWord1,
    sentenceWord2,
    translationToWord,
  });
}

test.describe("Review Step", () => {
  test("complete all review steps to reach completion screen", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const completionScoreText = "5/5";
    const sentenceWord1 = `Hola-${uniqueId}`;
    const sentenceWord2 = `amigo-${uniqueId}`;

    const words = [
      { translation: `cat-${uniqueId}`, word: `gato-${uniqueId}` },
      { translation: `dog-${uniqueId}`, word: `perro-${uniqueId}` },
      { translation: `bird-${uniqueId}`, word: `pajaro-${uniqueId}` },
      { translation: `fish-${uniqueId}`, word: `pez-${uniqueId}` },
    ];

    const translationToWord = Object.fromEntries(
      words.map(({ translation, word }) => [translation, word]),
    );

    const { url } = await createReviewActivity({
      sentences: [
        {
          sentence: `${sentenceWord1} ${sentenceWord2}`,
          translation: `Hello-${uniqueId} friend-${uniqueId}`,
        },
      ],
      words,
    });

    await page.goto(url);

    // Steps are shuffled, so complete each step by detecting its type.
    // 5 total steps: 4 vocabulary + 1 reading
    await completeRemainingReviewSteps({
      completionScoreText,
      page,
      remainingStepCount: 5,
      sentenceWord1,
      sentenceWord2,
      translationToWord,
    });

    // Completion screen
    await expect(page.getByRole("status")).toBeVisible();
    await expect(page.getByText(completionScoreText, { exact: true })).toBeVisible();
    await expect(page.getByText(/correct/i)).toBeVisible();
  });
});
