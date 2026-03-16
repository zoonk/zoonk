import { randomUUID } from "node:crypto";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonWordFixture } from "@zoonk/testing/fixtures/lesson-words";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { expect, test } from "./fixtures";

async function createFlashcardActivity(options: {
  words: {
    word: string;
    translation: string;
    romanization?: string | null;
  }[];
}) {
  const org = await getAiOrganization();

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-flash-course-${uniqueId}`,
    title: `E2E Flash Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-flash-chapter-${uniqueId}`,
    title: `E2E Flash Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `E2E flashcard lesson ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-flash-lesson-${uniqueId}`,
    title: `E2E Flash Lesson ${uniqueId}`,
  });

  const createdWords = await Promise.all(
    options.words.map((wordData) =>
      wordFixture({
        organizationId: org.id,
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
    title: `E2E Flashcard Activity ${uniqueId}`,
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

test.describe("Vocabulary Flashcard Step", () => {
  test("displays word, translation, and romanization", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const word = `gato-${uniqueId}`;
    const translation = `cat-${uniqueId}`;
    const romanization = `ga-to-${uniqueId}`;

    const { url } = await createFlashcardActivity({
      words: [{ romanization, translation, word }],
    });

    await page.goto(url);

    await expect(page.getByText(word)).toBeVisible();
    await expect(page.getByText(translation)).toBeVisible();
    await expect(page.getByText(romanization)).toBeVisible();
  });

  test("navigates through flashcards and reaches completion", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);

    const { url } = await createFlashcardActivity({
      words: [
        { translation: `cat-${uniqueId}`, word: `gato-${uniqueId}` },
        { translation: `dog-${uniqueId}`, word: `perro-${uniqueId}` },
        { translation: `bird-${uniqueId}`, word: `pájaro-${uniqueId}` },
      ],
    });

    await page.goto(url);

    // First card
    await expect(page.getByText(`gato-${uniqueId}`)).toBeVisible();

    // Navigate to next card
    const nextButton = page.getByRole("button", { name: /next/i });
    await nextButton.click();
    await expect(page.getByText(`perro-${uniqueId}`)).toBeVisible();

    // Navigate to last card
    await nextButton.click();
    await expect(page.getByText(`pájaro-${uniqueId}`)).toBeVisible();

    // Navigate past last card to reach completion
    await nextButton.click();
    await expect(page.getByText(/completed/i)).toBeVisible();
  });

  test("prev navigation works between flashcards", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);

    const { url } = await createFlashcardActivity({
      words: [
        { translation: `sun-${uniqueId}`, word: `sol-${uniqueId}` },
        { translation: `moon-${uniqueId}`, word: `luna-${uniqueId}` },
      ],
    });

    await page.goto(url);

    // First card
    await expect(page.getByText(`sol-${uniqueId}`)).toBeVisible();

    // Navigate forward
    await page.getByRole("button", { name: /next/i }).click();
    await expect(page.getByText(`luna-${uniqueId}`)).toBeVisible();

    // Navigate back
    await page.getByRole("button", { name: /previous/i }).click();
    await expect(page.getByText(`sol-${uniqueId}`)).toBeVisible();
  });

  test("no quiz interaction — no radiogroup or check button", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);

    const { url } = await createFlashcardActivity({
      words: [{ translation: `hello-${uniqueId}`, word: `hola-${uniqueId}` }],
    });

    await page.goto(url);

    await expect(page.getByRole("radiogroup")).not.toBeVisible();
    await expect(page.getByRole("button", { name: /check/i })).not.toBeVisible();
  });
});
