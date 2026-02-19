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

async function createReadingActivity(options: {
  sentences: { audioUrl?: string | null; sentence: string; translation: string }[];
  words: { translation: string; word: string }[];
}) {
  const org = await getAiOrganization();

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-reading-course-${uniqueId}`,
    title: `E2E Reading Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-reading-chapter-${uniqueId}`,
    title: `E2E Reading Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `E2E reading lesson ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-reading-lesson-${uniqueId}`,
    title: `E2E Reading Lesson ${uniqueId}`,
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
    kind: "reading",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
    title: `E2E Reading Activity ${uniqueId}`,
  });

  await Promise.all(
    createdSentences.map((sentence, index) =>
      stepFixture({
        activityId: activity.id,
        content: {},
        isPublished: true,
        kind: "reading",
        position: index,
        sentenceId: sentence.id,
      }),
    ),
  );

  const url = `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`;

  return { url };
}

async function answerReadingStep(page: Page, word1: string, word2: string) {
  const wordBank = page.getByRole("group", { name: /word bank/i });
  await wordBank.getByRole("button", { exact: true, name: word1 }).click();
  await wordBank.getByRole("button", { exact: true, name: word2 }).click();
  await page.getByRole("button", { name: /check/i }).click();
  await page.getByRole("button", { name: /continue/i }).click();
}

test.describe("Reading Step", () => {
  test("renders translation prompt and word bank with correct and distractor words", async ({
    page,
  }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const sentenceWord1 = `Hola-${uniqueId}`;
    const sentenceWord2 = `mundo-${uniqueId}`;

    const { url } = await createReadingActivity({
      sentences: [
        {
          sentence: `${sentenceWord1} ${sentenceWord2}`,
          translation: `Hello-${uniqueId} world-${uniqueId}`,
        },
      ],
      words: [
        { translation: `cat-${uniqueId}`, word: `gato-${uniqueId}` },
        { translation: `dog-${uniqueId}`, word: `perro-${uniqueId}` },
      ],
    });

    await page.goto(url);

    await expect(page.getByText(/translate this sentence/i)).toBeVisible();

    const wordBank = page.getByRole("group", { name: /word bank/i });
    await expect(wordBank).toBeVisible();

    // Correct sentence words should be in the word bank
    await expect(wordBank.getByRole("button", { exact: true, name: sentenceWord1 })).toBeVisible();
    await expect(wordBank.getByRole("button", { exact: true, name: sentenceWord2 })).toBeVisible();

    // Distractor words should also be in the word bank
    await expect(
      wordBank.getByRole("button", { exact: true, name: `gato-${uniqueId}` }),
    ).toBeVisible();
    await expect(
      wordBank.getByRole("button", { exact: true, name: `perro-${uniqueId}` }),
    ).toBeVisible();
  });

  test("tapping words adds them to the answer area in order", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const sentenceWord = `Hola-${uniqueId}`;

    const { url } = await createReadingActivity({
      sentences: [
        {
          sentence: `${sentenceWord} mundo-${uniqueId}`,
          translation: `Hello-${uniqueId} world-${uniqueId}`,
        },
      ],
      words: [{ translation: `cat-${uniqueId}`, word: `gato-${uniqueId}` }],
    });

    await page.goto(url);

    const wordBank = page.getByRole("group", { name: /word bank/i });
    const answerArea = page.getByRole("group", { name: /your answer/i });

    // Initially shows placeholder
    await expect(answerArea.getByText(/tap words to build your answer/i)).toBeVisible();

    // Tap a word
    await expect(async () => {
      await wordBank.getByRole("button", { exact: true, name: sentenceWord }).click();
      await expect(
        answerArea.getByRole("button", { name: new RegExp(`Position 1.*${sentenceWord}`, "i") }),
      ).toBeVisible({ timeout: 1000 });
    }).toPass();
  });

  test("tapping a placed word removes it from the answer area", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const sentenceWord = `Hola-${uniqueId}`;

    const { url } = await createReadingActivity({
      sentences: [
        {
          sentence: `${sentenceWord} mundo-${uniqueId}`,
          translation: `Hello-${uniqueId} world-${uniqueId}`,
        },
      ],
      words: [{ translation: `cat-${uniqueId}`, word: `gato-${uniqueId}` }],
    });

    await page.goto(url);

    const wordBank = page.getByRole("group", { name: /word bank/i });
    const answerArea = page.getByRole("group", { name: /your answer/i });

    // Place a word
    await expect(async () => {
      await wordBank.getByRole("button", { exact: true, name: sentenceWord }).click();
      await expect(
        answerArea.getByRole("button", { name: new RegExp(`Position 1.*${sentenceWord}`, "i") }),
      ).toBeVisible({ timeout: 1000 });
    }).toPass();

    // Remove it by tapping in answer area
    await answerArea
      .getByRole("button", { name: new RegExp(`Position 1.*${sentenceWord}`, "i") })
      .click();
    await expect(answerArea.getByText(/tap words to build your answer/i)).toBeVisible();
  });

  test("correct arrangement shows inline correct feedback and continue button", async ({
    page,
  }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const word1 = `Buenos-${uniqueId}`;
    const word2 = `dias-${uniqueId}`;

    const { url } = await createReadingActivity({
      sentences: [
        { sentence: `${word1} ${word2}`, translation: `Good-${uniqueId} morning-${uniqueId}` },
      ],
      words: [{ translation: `night-${uniqueId}`, word: `noche-${uniqueId}` }],
    });

    await page.goto(url);

    const wordBank = page.getByRole("group", { name: /word bank/i });

    // Arrange in correct order
    await expect(async () => {
      await wordBank.getByRole("button", { exact: true, name: word1 }).click();
      await expect(
        page
          .getByRole("group", { name: /your answer/i })
          .getByRole("button", { name: new RegExp(word1) }),
      ).toBeVisible({ timeout: 1000 });
    }).toPass();

    await wordBank.getByRole("button", { exact: true, name: word2 }).click();

    // Auto-submits, then check
    await page.getByRole("button", { name: /check/i }).click();
    await expect(page.getByRole("button", { name: /continue/i })).toBeVisible();
  });

  test("wrong arrangement shows correct sentence in feedback", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const word1 = `Buenos-${uniqueId}`;
    const word2 = `dias-${uniqueId}`;
    const sentence = `${word1} ${word2}`;

    const { url } = await createReadingActivity({
      sentences: [{ sentence, translation: `Good-${uniqueId} morning-${uniqueId}` }],
      words: [{ translation: `night-${uniqueId}`, word: `noche-${uniqueId}` }],
    });

    await page.goto(url);

    const wordBank = page.getByRole("group", { name: /word bank/i });

    // Arrange in wrong order (swap the words)
    await expect(async () => {
      await wordBank.getByRole("button", { exact: true, name: word2 }).click();
      await expect(
        page
          .getByRole("group", { name: /your answer/i })
          .getByRole("button", { name: new RegExp(word2) }),
      ).toBeVisible({ timeout: 1000 });
    }).toPass();

    await wordBank.getByRole("button", { exact: true, name: word1 }).click();

    await page.getByRole("button", { name: /check/i }).click();

    // Shows the correct answer
    await expect(page.getByText(new RegExp(`Correct answer.*${word1}`))).toBeVisible();
    await expect(page.getByRole("button", { name: /continue/i })).toBeVisible();
  });

  test("full flow: complete all reading steps to completion screen", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const word1a = `Hola-${uniqueId}`;
    const word1b = `amigo-${uniqueId}`;
    const word2a = `Adios-${uniqueId}`;
    const word2b = `mundo-${uniqueId}`;

    const { url } = await createReadingActivity({
      sentences: [
        { sentence: `${word1a} ${word1b}`, translation: `Hello-${uniqueId} friend-${uniqueId}` },
        { sentence: `${word2a} ${word2b}`, translation: `Bye-${uniqueId} world-${uniqueId}` },
      ],
      words: [{ translation: `cat-${uniqueId}`, word: `gato-${uniqueId}` }],
    });

    await page.goto(url);

    // Step 1
    await answerReadingStep(page, word1a, word1b);

    // Step 2
    await answerReadingStep(page, word2a, word2b);

    // Completion screen
    await expect(page.getByText("2/2")).toBeVisible();
    await expect(page.getByText(/correct/i)).toBeVisible();
  });
});
