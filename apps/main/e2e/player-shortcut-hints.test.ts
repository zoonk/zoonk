import { randomUUID } from "node:crypto";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { chapterWordFixture, wordFixture } from "@zoonk/testing/fixtures/words";
import { type Page, expect, test } from "./fixtures";

const FIRST_LOCAL_DAY = new Date("2030-06-15T12:00:00.000Z");
const NEXT_LOCAL_DAY = new Date("2030-06-16T12:00:00.000Z");

const SILENT_AUDIO_URL =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

type ShortcutHintLessons = Awaited<ReturnType<typeof createShortcutHintLessons>>;

/**
 * Creates one route for each player interaction family so the browser can prove
 * that navigation, audio, choice, and submit hints remain independent while
 * sharing the same daily browser history.
 */
async function createShortcutHintLessons() {
  const organization = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: organization.id,
    slug: `e2e-shortcut-hints-course-${uniqueId}`,
    targetLanguage: "es",
    title: `E2E Shortcut Hints Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: organization.id,
    position: 0,
    slug: `e2e-shortcut-hints-chapter-${uniqueId}`,
    title: `E2E Shortcut Hints Chapter ${uniqueId}`,
  });

  const firstNavigationTitle = `First shortcut step ${uniqueId}`;
  const secondNavigationTitle = `Second shortcut step ${uniqueId}`;
  const audioWordText = `Audio-${uniqueId}`;
  const choiceOptionText = `Choice-${uniqueId}`;
  const question = `Which option is correct ${uniqueId}?`;

  const [navigationLesson, audioLesson, choiceLesson, audioWord] = await Promise.all([
    lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
      organizationId: organization.id,
      position: 0,
      slug: `e2e-shortcut-hints-navigation-${uniqueId}`,
      title: `E2E Shortcut Navigation ${uniqueId}`,
    }),
    lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      kind: "vocabulary",
      organizationId: organization.id,
      position: 1,
      slug: `e2e-shortcut-hints-audio-${uniqueId}`,
      title: `E2E Shortcut Audio ${uniqueId}`,
    }),
    lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      kind: "quiz",
      organizationId: organization.id,
      position: 2,
      slug: `e2e-shortcut-hints-choice-${uniqueId}`,
      title: `E2E Shortcut Choice ${uniqueId}`,
    }),
    wordFixture({
      audioUrl: SILENT_AUDIO_URL,
      organizationId: organization.id,
      targetLanguage: "es",
      word: audioWordText,
    }),
  ]);

  const chapterWord = await chapterWordFixture({
    sourceLessonId: audioLesson.id,
    translation: `Audio translation ${uniqueId}`,
    wordId: audioWord.id,
  });

  await Promise.all([
    stepFixture({
      content: {
        text: `First shortcut body ${uniqueId}`,
        title: firstNavigationTitle,
        variant: "text",
      },
      isPublished: true,
      lessonId: navigationLesson.id,
      position: 0,
    }),
    stepFixture({
      content: {
        text: `Second shortcut body ${uniqueId}`,
        title: secondNavigationTitle,
        variant: "text",
      },
      isPublished: true,
      lessonId: navigationLesson.id,
      position: 1,
    }),
    stepFixture({
      chapterWordId: chapterWord.id,
      content: {},
      isPublished: true,
      kind: "vocabulary",
      lessonId: audioLesson.id,
      wordId: audioWord.id,
    }),
    stepFixture({
      content: {
        options: [
          {
            feedback: "Correct",
            id: `correct-${uniqueId}`,
            isCorrect: true,
            text: choiceOptionText,
          },
          {
            feedback: "Try again",
            id: `incorrect-${uniqueId}`,
            isCorrect: false,
            text: `Other-${uniqueId}`,
          },
        ],
        question,
      },
      isPublished: true,
      kind: "multipleChoice",
      lessonId: choiceLesson.id,
    }),
  ]);

  const lessonPath = `/b/${organization.slug}/c/${course.slug}/ch/${chapter.slug}/l`;

  return {
    audio: { url: `${lessonPath}/${audioLesson.slug}`, word: audioWordText },
    choice: { option: choiceOptionText, question, url: `${lessonPath}/${choiceLesson.slug}` },
    navigation: {
      firstTitle: firstNavigationTitle,
      secondTitle: secondNavigationTitle,
      url: `${lessonPath}/${navigationLesson.slug}`,
    },
  };
}

/**
 * Sonner renders each notification as a semantic list item, while the visible
 * key remains a separate text fragment so learners can scan the shortcut.
 */
function getShortcutHint({ page, shortcut }: { page: Page; shortcut: string }) {
  return page.getByRole("listitem").filter({ has: page.getByText(shortcut, { exact: true }) });
}

/**
 * Waiting for the player-specific heading confirms the server-rendered lesson
 * is visible. Keyboard assertions retry their action separately because the
 * client listeners can hydrate after this content appears.
 */
async function openNavigationLesson({
  lessons,
  page,
}: {
  lessons: ShortcutHintLessons;
  page: Page;
}) {
  await page.goto(lessons.navigation.url);
  await expect(page.getByRole("heading", { name: lessons.navigation.firstTitle })).toBeVisible();
}

/**
 * Multiple-choice options are shuffled on the server, so the test reads the
 * option's accessible shortcut instead of assuming a fixed rendered position.
 */
async function getChoiceShortcut({ lessons, page }: { lessons: ShortcutHintLessons; page: Page }) {
  const option = page.getByRole("radio", { name: lessons.choice.option });
  const shortcut = await option.getAttribute("aria-keyshortcuts");

  if (!shortcut) {
    throw new Error("Expected the multiple-choice option to expose its numeric shortcut");
  }

  expect(shortcut).toMatch(/^[1-9]$/u);

  return { option, shortcut };
}

test.describe("Player shortcut hints", () => {
  test("mouse interactions show five independent hints without duplicate arrow badges", async ({
    userWithoutProgress,
  }) => {
    const lessons = await createShortcutHintLessons();

    await openNavigationLesson({ lessons, page: userWithoutProgress });

    const navigationControls = userWithoutProgress.getByRole("toolbar", {
      name: /lesson controls/iu,
    });

    const nextButton = navigationControls.getByRole("button", { name: "Next step" });

    await expect(nextButton).toHaveAttribute("aria-keyshortcuts", "ArrowRight");
    await expect(nextButton.getByText("→", { exact: true })).not.toBeVisible();

    await nextButton.click();
    await expect(getShortcutHint({ page: userWithoutProgress, shortcut: "→" })).toBeVisible();

    await expect(
      userWithoutProgress.getByRole("heading", { name: lessons.navigation.secondTitle }),
    ).toBeVisible();

    const previousButton = navigationControls.getByRole("button", { name: "Previous step" });

    await expect(previousButton).toHaveAttribute("aria-keyshortcuts", "ArrowLeft");
    await expect(previousButton.getByText("←", { exact: true })).not.toBeVisible();

    await previousButton.click();
    await expect(getShortcutHint({ page: userWithoutProgress, shortcut: "←" })).toBeVisible();

    await userWithoutProgress.goto(lessons.audio.url);

    const playButton = userWithoutProgress
      .getByRole("toolbar", { name: /lesson controls/iu })
      .getByRole("button", { name: /play pronunciation/iu });

    await expect(playButton).toBeVisible();
    await playButton.click();
    await expect(getShortcutHint({ page: userWithoutProgress, shortcut: "P" })).toBeVisible();

    await userWithoutProgress.goto(lessons.choice.url);

    await expect(
      userWithoutProgress.getByText(lessons.choice.question, { exact: true }),
    ).toBeVisible();

    const { option, shortcut } = await getChoiceShortcut({ lessons, page: userWithoutProgress });

    await option.click();
    await expect(getShortcutHint({ page: userWithoutProgress, shortcut })).toBeVisible();

    const checkButton = userWithoutProgress.getByRole("button", { name: /check/iu });

    await expect(checkButton).toBeEnabled();
    await checkButton.click();
    await expect(getShortcutHint({ page: userWithoutProgress, shortcut: "Enter" })).toBeVisible();
  });

  test("a shortcut hint appears once per local day and returns the next local day", async ({
    userWithoutProgress,
  }) => {
    const lessons = await createShortcutHintLessons();

    await userWithoutProgress.clock.setFixedTime(FIRST_LOCAL_DAY);
    await openNavigationLesson({ lessons, page: userWithoutProgress });

    await userWithoutProgress.getByRole("button", { name: "Next step" }).click();
    await expect(getShortcutHint({ page: userWithoutProgress, shortcut: "→" })).toBeVisible();

    await userWithoutProgress.reload();

    await expect(
      userWithoutProgress.getByRole("heading", { name: lessons.navigation.firstTitle }),
    ).toBeVisible();

    await userWithoutProgress.getByRole("button", { name: "Next step" }).click();

    await expect(
      userWithoutProgress.getByRole("heading", { name: lessons.navigation.secondTitle }),
    ).toBeVisible();

    await expect(getShortcutHint({ page: userWithoutProgress, shortcut: "→" })).toHaveCount(0);

    await userWithoutProgress.clock.setFixedTime(NEXT_LOCAL_DAY);
    await userWithoutProgress.reload();

    await expect(
      userWithoutProgress.getByRole("heading", { name: lessons.navigation.firstTitle }),
    ).toBeVisible();

    await userWithoutProgress.getByRole("button", { name: "Next step" }).click();
    await expect(getShortcutHint({ page: userWithoutProgress, shortcut: "→" })).toBeVisible();
  });

  test("using player keyboard shortcuts does not show mouse guidance", async ({
    userWithoutProgress,
  }) => {
    const lessons = await createShortcutHintLessons();

    await openNavigationLesson({ lessons, page: userWithoutProgress });

    await expect(async () => {
      await userWithoutProgress.keyboard.press("ArrowRight");

      await expect(
        userWithoutProgress.getByRole("heading", { name: lessons.navigation.secondTitle }),
      ).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 5000 });

    await expect(getShortcutHint({ page: userWithoutProgress, shortcut: "→" })).toHaveCount(0);

    await userWithoutProgress.keyboard.press("ArrowLeft");

    await expect(
      userWithoutProgress.getByRole("heading", { name: lessons.navigation.firstTitle }),
    ).toBeVisible();

    await expect(getShortcutHint({ page: userWithoutProgress, shortcut: "←" })).toHaveCount(0);

    await userWithoutProgress.goto(lessons.audio.url);

    await expect(
      userWithoutProgress.getByRole("button", { name: /play pronunciation/iu }),
    ).toBeVisible();

    await userWithoutProgress.keyboard.press("p");
    await expect(getShortcutHint({ page: userWithoutProgress, shortcut: "P" })).toHaveCount(0);

    await userWithoutProgress.goto(lessons.choice.url);

    await expect(
      userWithoutProgress.getByText(lessons.choice.question, { exact: true }),
    ).toBeVisible();

    const { option, shortcut } = await getChoiceShortcut({ lessons, page: userWithoutProgress });

    await expect(async () => {
      await option.press(shortcut);
      await expect(option).toHaveAttribute("aria-checked", "true", { timeout: 500 });
    }).toPass({ timeout: 5000 });

    await expect(getShortcutHint({ page: userWithoutProgress, shortcut })).toHaveCount(0);

    await userWithoutProgress.keyboard.press("Enter");

    await expect(userWithoutProgress.getByText(/your answer:/iu)).toBeVisible();

    await expect(getShortcutHint({ page: userWithoutProgress, shortcut: "Enter" })).toHaveCount(0);
  });

  test.describe("touch input", () => {
    test.use({ hasTouch: true, viewport: { height: 667, width: 375 } });

    test("touch navigation does not show keyboard guidance", async ({ page }) => {
      const lessons = await createShortcutHintLessons();

      await page.goto(lessons.navigation.url);
      await expect(page.getByRole("heading", { name: "Progress won't be saved" })).toBeVisible();
      await page.getByRole("button", { name: "Continue without saving" }).tap();

      await expect(
        page.getByRole("heading", { name: lessons.navigation.firstTitle }),
      ).toBeVisible();

      await page.getByRole("button", { name: "Next" }).tap();

      await expect(
        page.getByRole("heading", { name: lessons.navigation.secondTitle }),
      ).toBeVisible();

      await expect(getShortcutHint({ page, shortcut: "→" })).toHaveCount(0);
    });
  });
});
