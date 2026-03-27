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

    await expect(option).toHaveAttribute("aria-checked", "true", { timeout: 1000 });
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
 * Completes a single step in the review. Steps are shuffled so we detect
 * the type and handle accordingly.
 */
async function completeAnyStep(
  page: Page,
  translationToWord: Record<string, string>,
  sentenceWord1: string,
  sentenceWord2: string,
): Promise<void> {
  // Wait for either a radiogroup (vocab) or word bank (reading) to appear
  const radiogroup = page.getByRole("radiogroup", { name: /answer options/i });
  const wordBank = page.getByRole("group", { name: /word bank/i });

  await expect(radiogroup.or(wordBank)).toBeVisible();

  const isVocab = await radiogroup.isVisible();

  if (isVocab) {
    await completeVocabStep(page, translationToWord);
  } else {
    await completeReadingStep(page, sentenceWord1, sentenceWord2);
  }
}

test.describe("Review Step", () => {
  test("complete all review steps to reach completion screen", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
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
    await completeAnyStep(page, translationToWord, sentenceWord1, sentenceWord2);
    await completeAnyStep(page, translationToWord, sentenceWord1, sentenceWord2);
    await completeAnyStep(page, translationToWord, sentenceWord1, sentenceWord2);
    await completeAnyStep(page, translationToWord, sentenceWord1, sentenceWord2);
    await completeAnyStep(page, translationToWord, sentenceWord1, sentenceWord2);

    // Completion screen
    await expect(page.getByText("5/5")).toBeVisible();
    await expect(page.getByText(/correct/i)).toBeVisible();
  });
});
