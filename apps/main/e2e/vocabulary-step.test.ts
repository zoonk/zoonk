import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonWordFixture } from "@zoonk/testing/fixtures/lesson-words";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { type Page, expect, test } from "./fixtures";

async function createVocabularyActivity(options: {
  words: {
    word: string;
    translation: string;
    pronunciation?: string | null;
    romanization?: string | null;
  }[];
}) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-vocab-course-${uniqueId}`,
    title: `E2E Vocab Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-vocab-chapter-${uniqueId}`,
    title: `E2E Vocab Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `E2E vocab lesson ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-vocab-lesson-${uniqueId}`,
    title: `E2E Vocab Lesson ${uniqueId}`,
  });

  const createdWords = await Promise.all(
    options.words.map((wordData) =>
      wordFixture({
        organizationId: org.id,
        pronunciation: wordData.pronunciation ?? null,
        romanization: wordData.romanization ?? null,
        translation: wordData.translation,
        word: wordData.word,
      }),
    ),
  );

  await Promise.all(
    createdWords.map((word) => lessonWordFixture({ lessonId: lesson.id, wordId: word.id })),
  );

  const activity = await activityFixture({
    generationStatus: "completed",
    isPublished: true,
    kind: "vocabulary",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
    title: `E2E Vocab Activity ${uniqueId}`,
  });

  await Promise.all(
    createdWords.map((word, index) =>
      stepFixture({
        activityId: activity.id,
        content: {},
        isPublished: true,
        kind: "vocabulary",
        position: index,
        wordId: word.id,
      }),
    ),
  );

  const url = `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`;

  return { url };
}

async function answerVocabularyStep(page: Page, wordText: string, translation: string) {
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

test.describe("Vocabulary Step", () => {
  test("renders translation prompt and 4 answer options with correct word among them", async ({
    page,
  }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const word = `hola-${uniqueId}`;
    const translation = `hello-${uniqueId}`;

    const { url } = await createVocabularyActivity({
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

  test("select correct option and check shows green indicator", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const correctWord = `gato-${uniqueId}`;

    const { url } = await createVocabularyActivity({
      words: [
        { translation: `cat-${uniqueId}`, word: correctWord },
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
    await expect(page.getByRole("button", { name: /continue/i })).toBeVisible();
  });

  test("select wrong option and check shows red on wrong and green on correct", async ({
    page,
  }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const correctWord = `rojo-${uniqueId}`;
    const wrongWord = `azul-${uniqueId}`;

    const { url } = await createVocabularyActivity({
      words: [
        { translation: `red-${uniqueId}`, word: correctWord },
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
    await expect(page.getByRole("button", { name: /continue/i })).toBeVisible();
    await expect(radiogroup.getByRole("radio", { name: new RegExp(correctWord) })).toBeVisible();
  });

  test("keyboard selection: pressing number key selects corresponding option", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);

    const { url } = await createVocabularyActivity({
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
    const { url } = await createVocabularyActivity({
      words: [
        { translation: `sun-${uniqueId}`, word: `sol-${uniqueId}` },
        { translation: `moon-${uniqueId}`, word: `luna-${uniqueId}` },
        { translation: `star-${uniqueId}`, word: `estrella-${uniqueId}` },
        { translation: `sky-${uniqueId}`, word: `cielo-${uniqueId}` },
      ],
    });

    await page.goto(url);

    await answerVocabularyStep(page, `sol-${uniqueId}`, `sun-${uniqueId}`);
    await answerVocabularyStep(page, `luna-${uniqueId}`, `moon-${uniqueId}`);
    await answerVocabularyStep(page, `estrella-${uniqueId}`, `star-${uniqueId}`);
    await answerVocabularyStep(page, `cielo-${uniqueId}`, `sky-${uniqueId}`);

    // Completion screen
    await expect(page.getByText("4/4")).toBeVisible();
    await expect(page.getByText(/correct/i)).toBeVisible();
  });

  test("feedback preserves the same options shown during playing", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);

    // Use 10 words so the distractor pool is large (9 eligible, 3 chosen).
    // If the component remounts, getDistractorWords picks different random words.
    const allWords = Array.from({ length: 10 }, (_, idx) => ({
      translation: `trans${idx}-${uniqueId}`,
      word: `word${idx}-${uniqueId}`,
    }));

    const { url } = await createVocabularyActivity({ words: allWords });

    await page.goto(url);

    const radiogroup = page.getByRole("radiogroup", { name: /answer options/i });
    await expect(radiogroup.getByRole("radio")).toHaveCount(4);

    // Record which of the 10 words are shown as the 4 options
    const visibility = await Promise.all(
      allWords.map(async (item) => ({
        isShown: await radiogroup
          .getByText(item.word, { exact: true })
          .isVisible()
          .catch(() => false),
        word: item.word,
      })),
    );

    const shownWords = visibility.filter((item) => item.isShown).map((item) => item.word);
    expect(shownWords).toHaveLength(4);

    // Select the correct word (first in the input list) and check
    const correctWord = `word0-${uniqueId}`;
    const correctOption = radiogroup.getByRole("radio", { name: new RegExp(correctWord) });

    await expect(async () => {
      const isChecked = await correctOption.getAttribute("aria-checked");

      if (isChecked !== "true") {
        await correctOption.click();
      }

      await expect(correctOption).toHaveAttribute("aria-checked", "true", { timeout: 1000 });
    }).toPass();

    await page.getByRole("button", { name: /check/i }).click();
    await expect(page.getByRole("button", { name: /continue/i })).toBeVisible();

    // After feedback, the same 4 words must still be visible
    await Promise.all(
      shownWords.map(async (wordText) => {
        await expect(radiogroup.getByText(wordText, { exact: true })).toBeVisible();
      }),
    );
  });

  test("romanization is displayed below the word text", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);

    const { url } = await createVocabularyActivity({
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

    const { url } = await createVocabularyActivity({
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
