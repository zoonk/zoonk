import { randomUUID } from "node:crypto";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonSentenceFixture } from "@zoonk/testing/fixtures/lesson-sentences";
import { lessonWordFixture } from "@zoonk/testing/fixtures/lesson-words";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { sentenceFixture, sentenceTranslationFixture } from "@zoonk/testing/fixtures/sentences";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { wordFixture, wordTranslationFixture } from "@zoonk/testing/fixtures/words";
import { type Page, expect, test } from "./fixtures";

async function createListeningActivity(options: {
  sentences: {
    audioUrl?: string | null;
    alternativeSentences?: string[];
    alternativeTranslations?: string[];
    romanization?: string | null;
    sentence: string;
    translation: string;
  }[];
  words: { alternativeTranslations?: string[]; translation: string; word: string }[];
  sentenceWords?: { romanization?: string | null; translation: string; word: string }[];
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

  const createdWords = await Promise.all(
    options.words.map(async (wordData) => {
      const word = await wordFixture({
        organizationId: org.id,
        word: wordData.word,
      });

      await wordTranslationFixture({
        alternativeTranslations: wordData.alternativeTranslations ?? [],
        translation: wordData.translation,
        wordId: word.id,
      });

      return word;
    }),
  );

  const createdSentences = await Promise.all(
    options.sentences.map(async (sentenceData) => {
      const sentence = await sentenceFixture({
        alternativeSentences: sentenceData.alternativeSentences ?? [],
        audioUrl: sentenceData.audioUrl ?? null,
        organizationId: org.id,
        romanization: sentenceData.romanization ?? null,
        sentence: sentenceData.sentence,
      });

      await sentenceTranslationFixture({
        alternativeTranslations: sentenceData.alternativeTranslations ?? [],
        sentenceId: sentence.id,
        translation: sentenceData.translation,
      });

      return sentence;
    }),
  );

  await Promise.all([
    ...createdWords.map((word) => lessonWordFixture({ lessonId: lesson.id, wordId: word.id })),
    ...createdSentences.map((sentence) =>
      lessonSentenceFixture({ lessonId: lesson.id, sentenceId: sentence.id }),
    ),
  ]);

  // Create sentence word records for target-language enrichment in feedback
  if (options.sentenceWords) {
    await Promise.all(
      options.sentenceWords.map(async (sw) => {
        const word = await wordFixture({
          organizationId: org.id,
          romanization: sw.romanization ?? null,
          word: sw.word,
        });

        await wordTranslationFixture({
          translation: sw.translation,
          wordId: word.id,
        });

        return word;
      }),
    );
  }

  const activity = await activityFixture({
    generationStatus: "completed",
    isPublished: true,
    kind: "listening",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
    title: `E2E Listen Activity ${uniqueId}`,
  });

  // Create a second activity so the tested one is not the last in the lesson.
  // This ensures tests see mid-lesson completion behavior (not lesson-complete).
  await Promise.all([
    ...createdSentences.map((sentence, index) =>
      stepFixture({
        activityId: activity.id,
        content: {},
        isPublished: true,
        kind: "listening",
        position: index,
        sentenceId: sentence.id,
      }),
    ),
    activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 1,
    }),
  ]);

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
    await expect(page.getByRole("button", { name: /play pronunciation/i })).toBeVisible();
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

  test("correct arrangement shows feedback screen with your answer", async ({ page }) => {
    const uniqueId = randomUUID().replaceAll("-", "").slice(0, 8);
    const transWord1 = `hello${uniqueId}`;
    const transWord2 = `world${uniqueId}`;
    const sentence = `hola${uniqueId} mundo${uniqueId}`;
    const translation = `${transWord1} ${transWord2}`;

    const { url } = await createListeningActivity({
      sentences: [{ audioUrl: "https://example.com/audio.mp3", sentence, translation }],
      words: [{ translation: `cat${uniqueId}`, word: `gato${uniqueId}` }],
    });

    await page.goto(url);

    const wordBank = page.getByRole("group", { name: /word bank/i });

    // Arrange correctly
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

    // Feedback screen shows the user's correct answer
    await expect(page.getByText(/your answer/i)).toBeVisible();
    await expect(page.getByText(translation)).toBeVisible();
  });

  test("wrong arrangement shows feedback screen with your answer and correct answer", async ({
    page,
  }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const transWord1 = `Hello-${uniqueId}`;
    const transWord2 = `world-${uniqueId}`;
    const sentence = `Hola-${uniqueId} mundo-${uniqueId}`;
    const translation = `${transWord1} ${transWord2}`;

    const { url } = await createListeningActivity({
      sentences: [{ audioUrl: "https://example.com/audio.mp3", sentence, translation }],
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

    // Feedback screen shows context (target language sentence)
    await expect(page.getByText(/translate/i)).toBeVisible();
    await expect(page.getByText(sentence)).toBeVisible();

    // Shows user's wrong arrangement
    await expect(page.getByText(/your answer/i)).toBeVisible();
    await expect(page.getByText(`${transWord2} ${transWord1}`)).toBeVisible();

    // Shows the correct answer
    await expect(page.getByText(/correct answer/i)).toBeVisible();
    await expect(page.getByText(translation)).toBeVisible();
  });

  test("hides alternative lexical listening words from the word bank", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const bom = `bom-${uniqueId}`;
    const dia = `dia-${uniqueId}`;
    const boa = `boa-${uniqueId}`;
    const tarde = `tarde-${uniqueId}`;
    const guten = `guten-${uniqueId}`;
    const tag = `tag-${uniqueId}`;
    const morgen = `morgen-${uniqueId}`;
    const lara = `lara-${uniqueId}`;
    const noite = `noite-${uniqueId}`;

    const { url } = await createListeningActivity({
      sentences: [
        {
          alternativeTranslations: [`${bom} ${dia} ${lara}`],
          sentence: `${guten} ${tag} ${lara}`,
          translation: `${boa} ${tarde} ${lara}`,
        },
      ],
      words: [
        { translation: `${bom} ${dia}`, word: `${guten} ${morgen}` },
        {
          alternativeTranslations: [`${bom} ${dia}`],
          translation: `${boa} ${tarde}`,
          word: `${guten} ${tag}`,
        },
        { translation: noite, word: `abend-${uniqueId}` },
      ],
    });

    await page.goto(url);

    const wordBank = page.getByRole("group", { name: /word bank/i });

    await expect(wordBank.getByRole("button", { exact: true, name: boa })).toBeVisible();
    await expect(wordBank.getByRole("button", { exact: true, name: tarde })).toBeVisible();
    await expect(wordBank.getByRole("button", { exact: true, name: lara })).toBeVisible();
    await expect(wordBank.getByRole("button", { exact: true, name: noite })).toBeVisible();
    await expect(wordBank.getByRole("button", { exact: true, name: bom })).toHaveCount(0);
    await expect(wordBank.getByRole("button", { exact: true, name: dia })).toHaveCount(0);
  });

  test("romanization shows on 'Translate:' line when correct", async ({ page }) => {
    const uniqueId = randomUUID().replaceAll("-", "").slice(0, 8);
    const transWord1 = `hello${uniqueId}`;
    const transWord2 = `world${uniqueId}`;
    const sentence = `konnichiwa${uniqueId} sekai${uniqueId}`;
    const romanization = `romaji${uniqueId} test${uniqueId}`;

    const { url } = await createListeningActivity({
      sentences: [
        {
          audioUrl: "https://example.com/audio.mp3",
          romanization,
          sentence,
          translation: `${transWord1} ${transWord2}`,
        },
      ],
      words: [{ translation: `cat${uniqueId}`, word: `neko${uniqueId}` }],
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

    await expect(page.getByText(romanization)).toBeVisible();
  });

  test("romanization shows on 'Translate:' line when incorrect", async ({ page }) => {
    const uniqueId = randomUUID().replaceAll("-", "").slice(0, 8);
    const transWord1 = `hello${uniqueId}`;
    const transWord2 = `world${uniqueId}`;
    const sentence = `konnichiwa${uniqueId} sekai${uniqueId}`;
    const romanization = `romaji${uniqueId} test${uniqueId}`;

    const { url } = await createListeningActivity({
      sentences: [
        {
          audioUrl: "https://example.com/audio.mp3",
          romanization,
          sentence,
          translation: `${transWord1} ${transWord2}`,
        },
      ],
      words: [{ translation: `cat${uniqueId}`, word: `neko${uniqueId}` }],
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

    await expect(page.getByText(romanization)).toBeVisible();
  });

  test("audio button shows on listening feedback", async ({ page }) => {
    const uniqueId = randomUUID().replaceAll("-", "").slice(0, 8);
    const transWord1 = `hello${uniqueId}`;
    const transWord2 = `world${uniqueId}`;

    const { url } = await createListeningActivity({
      sentences: [
        {
          audioUrl: "https://example.com/audio.mp3",
          sentence: `hola${uniqueId} mundo${uniqueId}`,
          translation: `${transWord1} ${transWord2}`,
        },
      ],
      words: [{ translation: `cat${uniqueId}`, word: `gato${uniqueId}` }],
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

    await expect(page.getByRole("button", { name: /play pronunciation/i })).toBeVisible();
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
