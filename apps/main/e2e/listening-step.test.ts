import { randomUUID } from "node:crypto";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonSentenceFixture } from "@zoonk/testing/fixtures/lesson-sentences";
import { lessonWordFixture } from "@zoonk/testing/fixtures/lesson-words";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { sentenceFixture } from "@zoonk/testing/fixtures/sentences";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { type Page, expect, test } from "./fixtures";

async function createListeningActivity(options: {
  sentences: { audioUrl?: string | null; sentence: string; translation: string }[];
  words: { translation: string; word: string }[];
}) {
  const org = await getAiOrganization();

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-listen-course-${uniqueId}`,
    title: `E2E Listen Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-listen-chapter-${uniqueId}`,
    title: `E2E Listen Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `E2E listen lesson ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-listen-lesson-${uniqueId}`,
    title: `E2E Listen Lesson ${uniqueId}`,
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
          audioUrl: sentenceData.audioUrl ?? null,
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
    kind: "listening",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
    title: `E2E Listen Activity ${uniqueId}`,
  });

  await Promise.all(
    createdSentences.map((sentence, index) =>
      stepFixture({
        activityId: activity.id,
        content: {},
        isPublished: true,
        kind: "listening",
        position: index,
        sentenceId: sentence.id,
      }),
    ),
  );

  const url = `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`;

  return { url };
}

async function answerListeningStep(page: Page, word1: string, word2: string) {
  const wordBank = page.getByRole("group", { name: /word bank/i });
  await wordBank.getByRole("button", { exact: true, name: word1 }).click();
  await wordBank.getByRole("button", { exact: true, name: word2 }).click();
  await page.getByRole("button", { name: /check/i }).click();
  await page.getByRole("button", { name: /continue/i }).click();
}

test.describe("Listening Step", () => {
  test("renders audio play button when audioUrl is present", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);

    const { url } = await createListeningActivity({
      sentences: [
        {
          audioUrl: "https://example.com/audio.mp3",
          sentence: `Hola-${uniqueId} mundo-${uniqueId}`,
          translation: `Hello-${uniqueId} world-${uniqueId}`,
        },
      ],
      words: [{ translation: `cat-${uniqueId}`, word: `gato-${uniqueId}` }],
    });

    await page.goto(url);

    await expect(page.getByText(/what do you hear/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /play audio/i })).toBeVisible();
  });

  test("falls back to text when audioUrl is null", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const sentence = `Hola-${uniqueId} mundo-${uniqueId}`;

    const { url } = await createListeningActivity({
      sentences: [{ sentence, translation: `Hello-${uniqueId} world-${uniqueId}` }],
      words: [{ translation: `cat-${uniqueId}`, word: `gato-${uniqueId}` }],
    });

    await page.goto(url);

    await expect(page.getByText(/translate this sentence/i)).toBeVisible();
    await expect(page.getByText(sentence)).toBeVisible();
  });

  test("correct translation arrangement shows success feedback", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const transWord1 = `Hello-${uniqueId}`;
    const transWord2 = `world-${uniqueId}`;

    const { url } = await createListeningActivity({
      sentences: [
        {
          sentence: `Hola-${uniqueId} mundo-${uniqueId}`,
          translation: `${transWord1} ${transWord2}`,
        },
      ],
      words: [{ translation: `cat-${uniqueId}`, word: `gato-${uniqueId}` }],
    });

    await page.goto(url);

    const wordBank = page.getByRole("group", { name: /word bank/i });

    await expect(async () => {
      await wordBank.getByRole("button", { exact: true, name: transWord1 }).click();
      await expect(
        page
          .getByRole("group", { name: /your answer/i })
          .getByRole("button", { name: new RegExp(transWord1) }),
      ).toBeVisible({ timeout: 1000 });
    }).toPass();

    await wordBank.getByRole("button", { exact: true, name: transWord2 }).click();

    await page.getByRole("button", { name: /check/i }).click();
    await expect(page.getByRole("button", { name: /continue/i })).toBeVisible();
  });

  test("wrong arrangement shows correct translation in feedback", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const transWord1 = `Hello-${uniqueId}`;
    const transWord2 = `world-${uniqueId}`;
    const translation = `${transWord1} ${transWord2}`;

    const { url } = await createListeningActivity({
      sentences: [
        {
          sentence: `Hola-${uniqueId} mundo-${uniqueId}`,
          translation,
        },
      ],
      words: [{ translation: `cat-${uniqueId}`, word: `gato-${uniqueId}` }],
    });

    await page.goto(url);

    const wordBank = page.getByRole("group", { name: /word bank/i });

    // Arrange in wrong order
    await expect(async () => {
      await wordBank.getByRole("button", { exact: true, name: transWord2 }).click();
      await expect(
        page
          .getByRole("group", { name: /your answer/i })
          .getByRole("button", { name: new RegExp(transWord2) }),
      ).toBeVisible({ timeout: 1000 });
    }).toPass();

    await wordBank.getByRole("button", { exact: true, name: transWord1 }).click();

    await page.getByRole("button", { name: /check/i }).click();

    await expect(page.getByText(new RegExp(`Correct answer.*${transWord1}`))).toBeVisible();
    await expect(page.getByRole("button", { name: /continue/i })).toBeVisible();
  });

  test("full flow: complete all listening steps to completion screen", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const trans1a = `Hello-${uniqueId}`;
    const trans1b = `friend-${uniqueId}`;
    const trans2a = `Goodbye-${uniqueId}`;
    const trans2b = `world-${uniqueId}`;

    const { url } = await createListeningActivity({
      sentences: [
        {
          sentence: `Hola-${uniqueId} amigo-${uniqueId}`,
          translation: `${trans1a} ${trans1b}`,
        },
        {
          sentence: `Adios-${uniqueId} mundo-${uniqueId}`,
          translation: `${trans2a} ${trans2b}`,
        },
      ],
      words: [{ translation: `cat-${uniqueId}`, word: `gato-${uniqueId}` }],
    });

    await page.goto(url);

    // Step 1: arrange translation words
    await answerListeningStep(page, trans1a, trans1b);

    // Step 2
    await answerListeningStep(page, trans2a, trans2b);

    // Completion screen
    await expect(page.getByText("2/2")).toBeVisible();
    await expect(page.getByText(/correct/i)).toBeVisible();
  });
});
