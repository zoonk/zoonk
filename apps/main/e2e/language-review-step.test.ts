import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonSentenceFixture } from "@zoonk/testing/fixtures/lesson-sentences";
import { lessonWordFixture } from "@zoonk/testing/fixtures/lesson-words";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { sentenceFixture } from "@zoonk/testing/fixtures/sentences";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { expect, test } from "./fixtures";

async function createLanguageReviewActivity(options: {
  sentences: { sentence: string; translation: string }[];
  words: { translation: string; word: string }[];
}) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

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
      options.words.map((wordData) =>
        wordFixture({
          organizationId: org.id,
          translation: wordData.translation,
          word: wordData.word,
        }),
      ),
    ),
    Promise.all(
      options.sentences.map((sentenceData) =>
        sentenceFixture({
          organizationId: org.id,
          sentence: sentenceData.sentence,
          translation: sentenceData.translation,
        }),
      ),
    ),
  ]);

  await Promise.all([
    ...createdWords.map((word) => lessonWordFixture({ lessonId: lesson.id, wordId: word.id })),
    ...createdSentences.map((sentence) =>
      lessonSentenceFixture({ lessonId: lesson.id, sentenceId: sentence.id }),
    ),
  ]);

  const activity = await activityFixture({
    generationStatus: "completed",
    isPublished: true,
    kind: "languageReview",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
    title: `E2E Review Activity ${uniqueId}`,
  });

  // Create vocabulary steps first, then reading steps
  const vocabStepCount = createdWords.length;

  await Promise.all([
    ...createdWords.map((word, index) =>
      stepFixture({
        activityId: activity.id,
        content: {},
        isPublished: true,
        kind: "vocabulary",
        position: index,
        wordId: word.id,
      }),
    ),
    ...createdSentences.map((sentence, index) =>
      stepFixture({
        activityId: activity.id,
        content: {},
        isPublished: true,
        kind: "reading",
        position: vocabStepCount + index,
        sentenceId: sentence.id,
      }),
    ),
  ]);

  const url = `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`;

  return { url };
}

test.describe("Language Review Step", () => {
  test("full flow: complete vocabulary then reading steps to completion", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const sentenceWord1 = `Hola-${uniqueId}`;
    const sentenceWord2 = `amigo-${uniqueId}`;

    const { url } = await createLanguageReviewActivity({
      sentences: [
        {
          sentence: `${sentenceWord1} ${sentenceWord2}`,
          translation: `Hello-${uniqueId} friend-${uniqueId}`,
        },
      ],
      words: [
        { translation: `cat-${uniqueId}`, word: `gato-${uniqueId}` },
        { translation: `dog-${uniqueId}`, word: `perro-${uniqueId}` },
        { translation: `bird-${uniqueId}`, word: `pajaro-${uniqueId}` },
        { translation: `fish-${uniqueId}`, word: `pez-${uniqueId}` },
      ],
    });

    await page.goto(url);

    // Step 1: Vocabulary step - select the correct word
    const radiogroup = page.getByRole("radiogroup", { name: /answer options/i });

    await expect(async () => {
      const option = radiogroup.getByRole("radio", { name: new RegExp(`gato-${uniqueId}`) });
      const isChecked = await option.getAttribute("aria-checked");

      if (isChecked !== "true") {
        await option.click();
      }

      await expect(option).toHaveAttribute("aria-checked", "true", { timeout: 1000 });
    }).toPass();

    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 2: Vocabulary step
    await expect(async () => {
      const option = radiogroup.getByRole("radio", { name: new RegExp(`perro-${uniqueId}`) });
      const isChecked = await option.getAttribute("aria-checked");

      if (isChecked !== "true") {
        await option.click();
      }

      await expect(option).toHaveAttribute("aria-checked", "true", { timeout: 1000 });
    }).toPass();

    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 3: Vocabulary step
    await expect(async () => {
      const option = radiogroup.getByRole("radio", { name: new RegExp(`pajaro-${uniqueId}`) });
      const isChecked = await option.getAttribute("aria-checked");

      if (isChecked !== "true") {
        await option.click();
      }

      await expect(option).toHaveAttribute("aria-checked", "true", { timeout: 1000 });
    }).toPass();

    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 4: Vocabulary step
    await expect(async () => {
      const option = radiogroup.getByRole("radio", { name: new RegExp(`pez-${uniqueId}`) });
      const isChecked = await option.getAttribute("aria-checked");

      if (isChecked !== "true") {
        await option.click();
      }

      await expect(option).toHaveAttribute("aria-checked", "true", { timeout: 1000 });
    }).toPass();

    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Step 5: Reading step - arrange words
    const wordBank = page.getByRole("group", { name: /word bank/i });
    await expect(wordBank).toBeVisible();

    await wordBank.getByRole("button", { exact: true, name: sentenceWord1 }).click();
    await wordBank.getByRole("button", { exact: true, name: sentenceWord2 }).click();

    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    // Completion screen
    await expect(page.getByText("5/5")).toBeVisible();
    await expect(page.getByText(/correct/i)).toBeVisible();
  });
});
