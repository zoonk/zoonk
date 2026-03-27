import { randomUUID } from "node:crypto";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import {
  lessonWordFixture,
  wordFixture,
  wordPronunciationFixture,
} from "@zoonk/testing/fixtures/words";
import { type Page, expect, test } from "./fixtures";

async function createTranslationActivity(options: {
  words: {
    alternativeTranslations?: string[];
    word: string;
    translation: string;
    pronunciation?: string | null;
    romanization?: string | null;
  }[];
  fallbackWords?: {
    alternativeTranslations?: string[];
    word: string;
    translation: string;
    pronunciation?: string | null;
    romanization?: string | null;
  }[];
}) {
  const org = await getAiOrganization();

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-trans-course-${uniqueId}`,
    title: `E2E Trans Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-trans-chapter-${uniqueId}`,
    title: `E2E Trans Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `E2E trans lesson ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-trans-lesson-${uniqueId}`,
    title: `E2E Trans Lesson ${uniqueId}`,
  });

  const createdWords = await Promise.all(
    options.words.map(async (wordData) => {
      const word = await wordFixture({
        organizationId: org.id,
        romanization: wordData.romanization ?? null,
        word: wordData.word,
      });

      await Promise.all([
        lessonWordFixture({
          alternativeTranslations: wordData.alternativeTranslations ?? [],
          lessonId: lesson.id,
          translation: wordData.translation,
          wordId: word.id,
        }),
        ...(wordData.pronunciation
          ? [wordPronunciationFixture({ pronunciation: wordData.pronunciation, wordId: word.id })]
          : []),
      ]);

      return word;
    }),
  );

  await Promise.all(
    (options.fallbackWords ?? []).map(async (wordData) => {
      const word = await wordFixture({
        organizationId: org.id,
        romanization: wordData.romanization ?? null,
        word: wordData.word,
      });

      await Promise.all([
        lessonWordFixture({
          alternativeTranslations: wordData.alternativeTranslations ?? [],
          lessonId: lesson.id,
          translation: wordData.translation,
          wordId: word.id,
        }),
        ...(wordData.pronunciation
          ? [wordPronunciationFixture({ pronunciation: wordData.pronunciation, wordId: word.id })]
          : []),
      ]);

      return word;
    }),
  );

  const activity = await activityFixture({
    generationStatus: "completed",
    isPublished: true,
    kind: "translation",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
    title: `E2E Trans Activity ${uniqueId}`,
  });

  // Create a second activity so the tested one is not the last in the lesson.
  // This ensures tests see mid-lesson completion behavior (not lesson-complete).
  await Promise.all([
    ...createdWords.map((word, index) =>
      stepFixture({
        activityId: activity.id,
        content: {},
        isPublished: true,
        kind: "translation",
        position: index,
        wordId: word.id,
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

async function answerTranslationStep(page: Page, wordText: string, translation: string) {
  const radiogroup = page.getByRole("radiogroup", { name: /answer options/i });
  await expect(page.getByText(translation)).toBeVisible();

  const option = radiogroup.getByRole("radio", { name: new RegExp(wordText) });

  await expect(async () => {
    const isChecked = await option.getAttribute("aria-checked");

    if (isChecked !== "true") {
      await option.click();
    }

    await expect(option).toHaveAttribute("aria-checked", "true", { timeout: 1000 });
  }).toPass();

  await page.getByRole("button", { name: /check/i }).click();
  await page.getByRole("button", { name: /continue/i }).click();
}

test.describe("Translation Step", () => {
  test("renders translation prompt and 4 answer options with correct word among them", async ({
    page,
  }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const word = `hola-${uniqueId}`;
    const translation = `hello-${uniqueId}`;

    const { url } = await createTranslationActivity({
      words: [
        { translation, word },
        { translation: `goodbye-${uniqueId}`, word: `adiós-${uniqueId}` },
        { translation: `thanks-${uniqueId}`, word: `gracias-${uniqueId}` },
        { translation: `please-${uniqueId}`, word: `por favor-${uniqueId}` },
      ],
    });

    await page.goto(url);

    await expect(page.getByText(/translate this word/i)).toBeVisible();
    await expect(page.getByText(translation)).toBeVisible();

    const radiogroup = page.getByRole("radiogroup", { name: /answer options/i });
    await expect(radiogroup).toBeVisible();
    await expect(radiogroup.getByRole("radio")).toHaveCount(4);
    await expect(radiogroup.getByRole("radio", { name: new RegExp(word) })).toBeVisible();
  });

  test("uses fallback words to keep four safe options when lesson words overlap in meaning", async ({
    page,
  }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const correctWord = `hola-${uniqueId}`;
    const ambiguousWord = `oi-${uniqueId}`;

    const { url } = await createTranslationActivity({
      fallbackWords: [
        { translation: `dog-${uniqueId}`, word: `perro-${uniqueId}` },
        { translation: `bird-${uniqueId}`, word: `pajaro-${uniqueId}` },
      ],
      words: [
        {
          alternativeTranslations: [`hi-${uniqueId}`],
          translation: `hello-${uniqueId}`,
          word: correctWord,
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

    const radiogroup = page.getByRole("radiogroup", { name: /answer options/i });

    await expect(radiogroup.getByRole("radio")).toHaveCount(4);
    await expect(radiogroup.getByRole("radio", { name: correctWord })).toBeVisible();
    await expect(radiogroup.getByRole("radio", { name: `gato-${uniqueId}` })).toBeVisible();
    await expect(radiogroup.getByRole("radio", { name: ambiguousWord })).toHaveCount(0);
  });

  test("select correct option and check shows feedback with translate context and answer", async ({
    page,
  }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const correctWord = `gato-${uniqueId}`;
    const translation = `cat-${uniqueId}`;

    const { url } = await createTranslationActivity({
      words: [
        { translation, word: correctWord },
        { translation: `dog-${uniqueId}`, word: `perro-${uniqueId}` },
        { translation: `bird-${uniqueId}`, word: `pájaro-${uniqueId}` },
        { translation: `fish-${uniqueId}`, word: `pez-${uniqueId}` },
      ],
    });

    await page.goto(url);

    const radiogroup = page.getByRole("radiogroup", { name: /answer options/i });
    const correctOption = radiogroup.getByRole("radio", { name: new RegExp(correctWord) });

    await expect(async () => {
      const isChecked = await correctOption.getAttribute("aria-checked");

      if (isChecked !== "true") {
        await correctOption.click();
      }

      await expect(correctOption).toHaveAttribute("aria-checked", "true", { timeout: 1000 });
    }).toPass();

    await page.getByRole("button", { name: /check/i }).click();

    await expect(page.getByText(new RegExp(`Translate:.*${translation}`))).toBeVisible();
    await expect(page.getByText(/your answer:/i)).toBeVisible();
    await expect(page.getByText(correctWord)).toBeVisible();
    await expect(page.getByRole("button", { name: /continue/i })).toBeVisible();
  });

  test("select wrong option shows feedback with wrong answer and correct answer", async ({
    page,
  }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const correctWord = `rojo-${uniqueId}`;
    const wrongWord = `azul-${uniqueId}`;
    const translation = `red-${uniqueId}`;

    const { url } = await createTranslationActivity({
      words: [
        { translation, word: correctWord },
        { translation: `blue-${uniqueId}`, word: wrongWord },
        { translation: `green-${uniqueId}`, word: `verde-${uniqueId}` },
        { translation: `yellow-${uniqueId}`, word: `amarillo-${uniqueId}` },
      ],
    });

    await page.goto(url);

    const radiogroup = page.getByRole("radiogroup", { name: /answer options/i });
    const wrongOption = radiogroup.getByRole("radio", { name: new RegExp(wrongWord) });

    await expect(async () => {
      const isChecked = await wrongOption.getAttribute("aria-checked");

      if (isChecked !== "true") {
        await wrongOption.click();
      }

      await expect(wrongOption).toHaveAttribute("aria-checked", "true", { timeout: 1000 });
    }).toPass();

    await page.getByRole("button", { name: /check/i }).click();

    await expect(page.getByText(new RegExp(`Translate:.*${translation}`))).toBeVisible();
    await expect(page.getByText(/your answer:/i)).toBeVisible();
    await expect(page.getByText(wrongWord)).toBeVisible();
    await expect(page.getByText(/correct answer:/i)).toBeVisible();
    await expect(page.getByText(correctWord)).toBeVisible();
    await expect(page.getByRole("button", { name: /continue/i })).toBeVisible();
  });

  test("keyboard selection: pressing number key selects corresponding option", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);

    const { url } = await createTranslationActivity({
      words: [
        { translation: `one-${uniqueId}`, word: `uno-${uniqueId}` },
        { translation: `two-${uniqueId}`, word: `dos-${uniqueId}` },
        { translation: `three-${uniqueId}`, word: `tres-${uniqueId}` },
        { translation: `four-${uniqueId}`, word: `cuatro-${uniqueId}` },
      ],
    });

    await page.goto(url);

    const radiogroup = page.getByRole("radiogroup", { name: /answer options/i });
    await expect(radiogroup).toBeVisible();

    await expect(async () => {
      await page.keyboard.press("1");
      const options = radiogroup.getByRole("radio");
      await expect(options.first()).toHaveAttribute("aria-checked", "true", { timeout: 1000 });
    }).toPass();

    await expect(page.getByRole("button", { name: /check/i })).toBeEnabled();
  });

  test("full flow: select, check, continue to completion", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const { url } = await createTranslationActivity({
      words: [
        { translation: `sun-${uniqueId}`, word: `sol-${uniqueId}` },
        { translation: `moon-${uniqueId}`, word: `luna-${uniqueId}` },
        { translation: `star-${uniqueId}`, word: `estrella-${uniqueId}` },
        { translation: `sky-${uniqueId}`, word: `cielo-${uniqueId}` },
      ],
    });

    await page.goto(url);

    await answerTranslationStep(page, `sol-${uniqueId}`, `sun-${uniqueId}`);
    await answerTranslationStep(page, `luna-${uniqueId}`, `moon-${uniqueId}`);
    await answerTranslationStep(page, `estrella-${uniqueId}`, `star-${uniqueId}`);
    await answerTranslationStep(page, `cielo-${uniqueId}`, `sky-${uniqueId}`);

    // Completion screen
    await expect(page.getByText("4/4")).toBeVisible();
    await expect(page.getByText(/correct/i)).toBeVisible();
  });

  test("feedback screen shows translate context and selected answer", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);

    const allWords = Array.from({ length: 10 }, (_, idx) => ({
      translation: `trans${idx}-${uniqueId}`,
      word: `word${idx}-${uniqueId}`,
    }));

    const { url } = await createTranslationActivity({ words: allWords });

    await page.goto(url);

    const radiogroup = page.getByRole("radiogroup", { name: /answer options/i });
    await expect(radiogroup.getByRole("radio")).toHaveCount(4);

    // Select the correct word (first in the input list) and check
    const correctWord = `word0-${uniqueId}`;
    const correctTranslation = `trans0-${uniqueId}`;
    const correctOption = radiogroup.getByRole("radio", { name: new RegExp(correctWord) });

    await expect(async () => {
      const isChecked = await correctOption.getAttribute("aria-checked");

      if (isChecked !== "true") {
        await correctOption.click();
      }

      await expect(correctOption).toHaveAttribute("aria-checked", "true", { timeout: 1000 });
    }).toPass();

    await page.getByRole("button", { name: /check/i }).click();

    // Feedback screen shows the translate context and the user's answer
    await expect(page.getByText(new RegExp(`Translate:.*${correctTranslation}`))).toBeVisible();
    await expect(page.getByText(/your answer:/i)).toBeVisible();
    await expect(page.getByText(correctWord)).toBeVisible();
    await expect(page.getByRole("button", { name: /continue/i })).toBeVisible();
  });

  test("romanization is displayed below the word text", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);

    const { url } = await createTranslationActivity({
      words: [
        {
          romanization: `konnichiwa-${uniqueId}`,
          translation: `hello-${uniqueId}`,
          word: `\u3053\u3093\u306B\u3061\u306F-${uniqueId}`,
        },
        {
          romanization: `sayounara-${uniqueId}`,
          translation: `goodbye-${uniqueId}`,
          word: `\u3055\u3088\u3046\u306A\u3089-${uniqueId}`,
        },
        {
          romanization: `arigatou-${uniqueId}`,
          translation: `thanks-${uniqueId}`,
          word: `\u3042\u308A\u304C\u3068\u3046-${uniqueId}`,
        },
        {
          romanization: `onegai-${uniqueId}`,
          translation: `please-${uniqueId}`,
          word: `\u304A\u306D\u304C\u3044-${uniqueId}`,
        },
      ],
    });

    await page.goto(url);
    await expect(page.getByText(new RegExp(`konnichiwa-${uniqueId}`))).toBeVisible();
  });

  test("pronunciation is shown only on the selected option", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const word = `hola-${uniqueId}`;
    const pronunciation = `pron-hola-${uniqueId}`;

    const { url } = await createTranslationActivity({
      words: [
        { pronunciation, translation: `hello-${uniqueId}`, word },
        {
          pronunciation: `pron-adios-${uniqueId}`,
          translation: `goodbye-${uniqueId}`,
          word: `adiós-${uniqueId}`,
        },
        {
          pronunciation: `pron-gracias-${uniqueId}`,
          translation: `thanks-${uniqueId}`,
          word: `gracias-${uniqueId}`,
        },
        {
          pronunciation: `pron-favor-${uniqueId}`,
          translation: `please-${uniqueId}`,
          word: `por favor-${uniqueId}`,
        },
      ],
    });

    await page.goto(url);

    const radiogroup = page.getByRole("radiogroup", { name: /answer options/i });

    // Before selecting, pronunciation should not be visible
    await expect(page.getByText(new RegExp(pronunciation))).not.toBeVisible();

    const option = radiogroup.getByRole("radio", { name: new RegExp(word) });

    await expect(async () => {
      const isChecked = await option.getAttribute("aria-checked");

      if (isChecked !== "true") {
        await option.click();
      }

      await expect(option).toHaveAttribute("aria-checked", "true", { timeout: 1000 });
    }).toPass();

    // After selecting, pronunciation should be visible on the selected option
    await expect(page.getByText(new RegExp(pronunciation))).toBeVisible();
  });
});
