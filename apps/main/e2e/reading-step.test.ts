import { randomUUID } from "node:crypto";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonSentenceFixture } from "@zoonk/testing/fixtures/lesson-sentences";
import { lessonWordFixture } from "@zoonk/testing/fixtures/lesson-words";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { sentenceAudioFixture, sentenceFixture } from "@zoonk/testing/fixtures/sentences";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { type Page, expect, test } from "./fixtures";

async function createReadingActivity(options: {
  fallbackWords?: {
    alternativeTranslations?: string[];
    romanization?: string | null;
    translation: string;
    word: string;
  }[];
  sentences: {
    audioUrl?: string | null;
    alternativeSentences?: string[];
    alternativeTranslations?: string[];
    romanization?: string | null;
    sentence: string;
    translation: string;
  }[];
  words: {
    alternativeTranslations?: string[];
    romanization?: string | null;
    translation: string;
    word: string;
  }[];
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

  const createdWords = await Promise.all(
    options.words.map((wordData) =>
      wordFixture({
        alternativeTranslations: wordData.alternativeTranslations ?? [],
        organizationId: org.id,
        romanization: wordData.romanization ?? null,
        translation: wordData.translation,
        word: wordData.word,
      }),
    ),
  );

  await Promise.all(
    (options.fallbackWords ?? []).map((wordData) =>
      wordFixture({
        alternativeTranslations: wordData.alternativeTranslations ?? [],
        organizationId: org.id,
        romanization: wordData.romanization ?? null,
        translation: wordData.translation,
        word: wordData.word,
      }),
    ),
  );

  const createdSentences = await Promise.all(
    options.sentences.map(async (sentenceData) => {
      let sentenceAudioId: bigint | null = null;

      if (sentenceData.audioUrl) {
        const audio = await sentenceAudioFixture({
          audioUrl: sentenceData.audioUrl,
          organizationId: org.id,
        });
        sentenceAudioId = audio.id;
      }

      return sentenceFixture({
        alternativeSentences: sentenceData.alternativeSentences ?? [],
        alternativeTranslations: sentenceData.alternativeTranslations ?? [],
        organizationId: org.id,
        romanization: sentenceData.romanization ?? null,
        sentence: sentenceData.sentence,
        sentenceAudioId,
        translation: sentenceData.translation,
      });
    }),
  );

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

  // Create a second activity so the tested one is not the last in the lesson.
  // This ensures tests see mid-lesson completion behavior (not lesson-complete).
  await Promise.all([
    ...createdSentences.map((sentence, index) =>
      stepFixture({
        activityId: activity.id,
        content: {},
        isPublished: true,
        kind: "reading",
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

  test("uses fallback words to keep four visible distractors for short reading steps", async ({
    page,
  }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const helloWord = `Hola-${uniqueId}`;
    const ambiguousWord = `Salut-${uniqueId}`;
    const worldWord = `mundo-${uniqueId}`;

    const { url } = await createReadingActivity({
      fallbackWords: [
        { translation: `dog-${uniqueId}`, word: `perro-${uniqueId}` },
        { translation: `bird-${uniqueId}`, word: `pajaro-${uniqueId}` },
        { translation: `fish-${uniqueId}`, word: `pez-${uniqueId}` },
      ],
      sentences: [
        {
          sentence: `${helloWord} ${worldWord}`,
          translation: `hello-${uniqueId} world-${uniqueId}`,
        },
      ],
      words: [
        {
          alternativeTranslations: [`hi-${uniqueId}`],
          translation: `hello-${uniqueId}`,
          word: helloWord,
        },
        {
          alternativeTranslations: [`hello-${uniqueId}`],
          translation: `hi-${uniqueId}`,
          word: ambiguousWord,
        },
        { translation: `cat-${uniqueId}`, word: `gato-${uniqueId}` },
      ],
    });

    await page.goto(url);

    const wordBank = page.getByRole("group", { name: /word bank/i });

    await expect(wordBank.getByRole("button")).toHaveCount(6);
    await expect(wordBank.getByRole("button", { exact: true, name: helloWord })).toBeVisible();
    await expect(wordBank.getByRole("button", { exact: true, name: worldWord })).toBeVisible();
    await expect(
      wordBank.getByRole("button", { exact: true, name: `gato-${uniqueId}` }),
    ).toBeVisible();
    await expect(wordBank.getByRole("button", { exact: true, name: ambiguousWord })).toHaveCount(0);
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

  test("wrong arrangement shows feedback screen with your answer and correct answer", async ({
    page,
  }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const word1 = `Buenos-${uniqueId}`;
    const word2 = `dias-${uniqueId}`;
    const sentence = `${word1} ${word2}`;
    const translation = `Good-${uniqueId} morning-${uniqueId}`;

    const { url } = await createReadingActivity({
      sentences: [{ sentence, translation }],
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

    // Feedback screen shows the translation as context
    await expect(page.getByText(/translate/i)).toBeVisible();
    await expect(page.getByText(translation)).toBeVisible();

    // Shows user's wrong arrangement
    await expect(page.getByText(/your answer/i)).toBeVisible();
    await expect(page.getByText(`${word2} ${word1}`)).toBeVisible();

    // Shows the correct answer
    await expect(page.getByText(/correct answer/i)).toBeVisible();
    await expect(page.getByText(sentence)).toBeVisible();
  });

  test("hides alternative lexical reading words from the word bank", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const guten = `Guten-${uniqueId}`;
    const tag = `Tag-${uniqueId}`;
    const morgen = `Morgen-${uniqueId}`;
    const lara = `Lara-${uniqueId}`;
    const abend = `Abend-${uniqueId}`;

    const { url } = await createReadingActivity({
      sentences: [
        {
          alternativeSentences: [`${guten} ${tag} ${lara}`],
          sentence: `${guten} ${morgen} ${lara}`,
          translation: `Bom-dia-${uniqueId}`,
        },
      ],
      words: [
        { translation: `Bom-dia-${uniqueId}`, word: `${guten} ${morgen}` },
        {
          alternativeTranslations: [`Bom-dia-${uniqueId}`],
          translation: `Boa-tarde-${uniqueId}`,
          word: `${guten} ${tag}`,
        },
        { translation: `night-${uniqueId}`, word: abend },
      ],
    });

    await page.goto(url);

    const wordBank = page.getByRole("group", { name: /word bank/i });

    await expect(wordBank.getByRole("button", { exact: true, name: guten })).toBeVisible();
    await expect(wordBank.getByRole("button", { exact: true, name: morgen })).toBeVisible();
    await expect(wordBank.getByRole("button", { exact: true, name: lara })).toBeVisible();
    await expect(wordBank.getByRole("button", { exact: true, name: abend })).toBeVisible();
    await expect(wordBank.getByRole("button", { exact: true, name: tag })).toHaveCount(0);
  });

  test("dragging a placed word reorders it in the answer area", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const word1 = `Uno-${uniqueId}`;
    const word2 = `Dos-${uniqueId}`;
    const word3 = `Tres-${uniqueId}`;

    const { url } = await createReadingActivity({
      sentences: [
        {
          sentence: `${word1} ${word2} ${word3}`,
          translation: `One-${uniqueId} Two-${uniqueId} Three-${uniqueId}`,
        },
      ],
      words: [{ translation: `cat-${uniqueId}`, word: `gato-${uniqueId}` }],
    });

    await page.goto(url);

    const wordBank = page.getByRole("group", { name: /word bank/i });
    const answerArea = page.getByRole("group", { name: /your answer/i });

    // Place all 3 words in order: word3, word1, word2 (wrong order)
    await expect(async () => {
      await wordBank.getByRole("button", { exact: true, name: word3 }).click();
      await expect(answerArea.getByRole("button", { name: new RegExp(word3) })).toBeVisible({
        timeout: 1000,
      });
    }).toPass();

    await wordBank.getByRole("button", { exact: true, name: word1 }).click();
    await wordBank.getByRole("button", { exact: true, name: word2 }).click();

    // Verify initial order: word3 is in position 1
    await expect(
      answerArea.getByRole("button", { name: new RegExp(`Position 1.*${word3}`, "i") }),
    ).toBeVisible();

    const buttons = answerArea.getByRole("button");

    // Get initial first button text
    const initialFirstText = await buttons.nth(0).textContent();

    // Drag second button to first position — retry for drag reliability
    await expect(async () => {
      await buttons.nth(1).dragTo(buttons.nth(0), { steps: 20 });
      const newFirstText = await buttons.nth(0).textContent();
      expect(newFirstText).not.toBe(initialFirstText);
    }).toPass({ timeout: 10_000 });
  });

  test("keyboard Enter/Space removes a placed word instead of starting drag", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const word1 = `Alfa-${uniqueId}`;
    const word2 = `Beta-${uniqueId}`;

    const { url } = await createReadingActivity({
      sentences: [
        {
          sentence: `${word1} ${word2}`,
          translation: `Alpha-${uniqueId} Bravo-${uniqueId}`,
        },
      ],
      words: [{ translation: `cat-${uniqueId}`, word: `gato-${uniqueId}` }],
    });

    await page.goto(url);

    const wordBank = page.getByRole("group", { name: /word bank/i });
    const answerArea = page.getByRole("group", { name: /your answer/i });

    // Place a word
    await expect(async () => {
      await wordBank.getByRole("button", { exact: true, name: word1 }).click();
      await expect(answerArea.getByRole("button", { name: new RegExp(word1) })).toBeVisible({
        timeout: 1000,
      });
    }).toPass();

    // Focus the placed word and press Enter — should remove it, not start a drag
    await answerArea.getByRole("button", { name: new RegExp(word1) }).focus();
    await page.keyboard.press("Enter");

    await expect(answerArea.getByText(/tap words to build your answer/i)).toBeVisible();

    // Place again and verify Space also removes
    await wordBank.getByRole("button", { exact: true, name: word1 }).click();
    await expect(answerArea.getByRole("button", { name: new RegExp(word1) })).toBeVisible();

    await answerArea.getByRole("button", { name: new RegExp(word1) }).focus();
    await page.keyboard.press("Space");

    await expect(answerArea.getByText(/tap words to build your answer/i)).toBeVisible();
  });

  test("romanization shows on correct answer feedback", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const word1 = `Konnichiwa-${uniqueId}`;
    const word2 = `sekai-${uniqueId}`;
    const romanization = `romaji-${uniqueId} test-${uniqueId}`;

    const { url } = await createReadingActivity({
      sentences: [
        {
          romanization,
          sentence: `${word1} ${word2}`,
          translation: `Hello-${uniqueId} world-${uniqueId}`,
        },
      ],
      words: [{ translation: `cat-${uniqueId}`, word: `neko-${uniqueId}` }],
    });

    await page.goto(url);

    const wordBank = page.getByRole("group", { name: /word bank/i });

    await expect(async () => {
      await wordBank.getByRole("button", { exact: true, name: word1 }).click();
      await expect(
        page
          .getByRole("group", { name: /your answer/i })
          .getByRole("button", { name: new RegExp(word1) }),
      ).toBeVisible({ timeout: 1000 });
    }).toPass();

    await wordBank.getByRole("button", { exact: true, name: word2 }).click();

    await page.getByRole("button", { name: /check/i }).click();

    await expect(page.getByText(romanization)).toBeVisible();
  });

  test("romanization shows on incorrect answer feedback", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const word1 = `Konnichiwa-${uniqueId}`;
    const word2 = `sekai-${uniqueId}`;
    const romanization = `romaji-${uniqueId} test-${uniqueId}`;

    const { url } = await createReadingActivity({
      sentences: [
        {
          romanization,
          sentence: `${word1} ${word2}`,
          translation: `Hello-${uniqueId} world-${uniqueId}`,
        },
      ],
      words: [{ translation: `cat-${uniqueId}`, word: `neko-${uniqueId}` }],
    });

    await page.goto(url);

    const wordBank = page.getByRole("group", { name: /word bank/i });

    // Arrange in wrong order
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

    await expect(page.getByText(romanization)).toBeVisible();
  });

  test("audio button shows when audioUrl exists", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const word1 = `Buenos-${uniqueId}`;
    const word2 = `dias-${uniqueId}`;

    const { url } = await createReadingActivity({
      sentences: [
        {
          audioUrl: "https://example.com/audio.mp3",
          sentence: `${word1} ${word2}`,
          translation: `Good-${uniqueId} morning-${uniqueId}`,
        },
      ],
      words: [{ translation: `night-${uniqueId}`, word: `noche-${uniqueId}` }],
    });

    await page.goto(url);

    const wordBank = page.getByRole("group", { name: /word bank/i });

    await expect(async () => {
      await wordBank.getByRole("button", { exact: true, name: word1 }).click();
      await expect(
        page
          .getByRole("group", { name: /your answer/i })
          .getByRole("button", { name: new RegExp(word1) }),
      ).toBeVisible({ timeout: 1000 });
    }).toPass();

    await wordBank.getByRole("button", { exact: true, name: word2 }).click();

    await page.getByRole("button", { name: /check/i }).click();

    await expect(page.getByRole("button", { name: /play pronunciation/i })).toBeVisible();
  });

  test("romanization dedup: not shown when equals sentence", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const word1 = `Buenos-${uniqueId}`;
    const word2 = `dias-${uniqueId}`;
    const sentence = `${word1} ${word2}`;

    const { url } = await createReadingActivity({
      sentences: [
        {
          // Simulate bad AI data: romanization equals the sentence
          romanization: sentence,
          sentence,
          translation: `Good-${uniqueId} morning-${uniqueId}`,
        },
      ],
      words: [{ translation: `night-${uniqueId}`, word: `noche-${uniqueId}` }],
    });

    await page.goto(url);

    const wordBank = page.getByRole("group", { name: /word bank/i });

    await expect(async () => {
      await wordBank.getByRole("button", { exact: true, name: word1 }).click();
      await expect(
        page
          .getByRole("group", { name: /your answer/i })
          .getByRole("button", { name: new RegExp(word1) }),
      ).toBeVisible({ timeout: 1000 });
    }).toPass();

    await wordBank.getByRole("button", { exact: true, name: word2 }).click();

    await page.getByRole("button", { name: /check/i }).click();

    // Feedback shows "Your answer:" with the sentence text
    await expect(page.getByText(/your answer/i)).toBeVisible();
    await expect(page.getByText(sentence)).toBeVisible();

    // Romanization should NOT appear as a separate element since it equals the sentence.
    // The sentence text appears once in the answer, not duplicated as romanization below it.
    await expect(page.getByText(sentence, { exact: true })).toHaveCount(1);
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
