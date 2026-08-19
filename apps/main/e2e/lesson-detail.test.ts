import { randomUUID } from "node:crypto";
import { setLocale } from "@zoonk/e2e/fixtures/locale";
import { createOrganization, getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { chapterSentenceFixture, sentenceFixture } from "@zoonk/testing/fixtures/sentences";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { chapterWordFixture, wordFixture } from "@zoonk/testing/fixtures/words";
import { type Page, expect, test } from "./fixtures";
import { pressShortcutAndWaitForUrl } from "./keyboard-shortcuts";

async function createTestLesson(options?: {
  chapterPosition?: number;
  generationStatus?: "pending" | "completed";
  lessonPosition?: number;
  stepCount?: number;
}) {
  const org = await getAiOrganization();

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-lesson-course-${uniqueId}`,
    title: `E2E Lesson Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    ...(options?.chapterPosition === undefined ? {} : { position: options.chapterPosition }),
    slug: `e2e-lesson-chapter-${uniqueId}`,
    title: `E2E Lesson Chapter ${uniqueId}`,
  });

  const lessonTitle = `E2E Lesson Lesson ${uniqueId}`;

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `E2E lesson description ${uniqueId}`,
    generationStatus: options?.generationStatus ?? "completed",
    isPublished: true,
    kind: "explanation",
    organizationId: org.id,
    ...(options?.lessonPosition === undefined ? {} : { position: options.lessonPosition }),
    slug: `e2e-lesson-lesson-${uniqueId}`,
    title: lessonTitle,
  });

  if (options?.generationStatus !== "pending") {
    const count = options?.stepCount ?? 1;

    await Promise.all(
      Array.from({ length: count }, (_, idx) =>
        stepFixture({
          content: {
            text: `Test step content ${uniqueId} #${idx}`,
            title: `Step ${uniqueId} #${idx}`,
            variant: "text",
          },
          isPublished: true,
          lessonId: lesson.id,
          position: idx,
        }),
      ),
    );
  }

  return { chapter, course, lesson, lessonTitle, organizationId: org.id, uniqueId };
}

/** Creates the access-policy free target so gate tests prove navigation reaches playable content. */
async function freeFirstLessonFixture({
  courseId,
  organizationId,
  uniqueId,
}: {
  courseId: string;
  organizationId: string;
  uniqueId: string;
}) {
  const chapter = await chapterFixture({
    courseId,
    isPublished: true,
    organizationId,
    position: 0,
    slug: `e2e-free-chapter-${uniqueId}`,
    title: `E2E Free Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    generationStatus: "completed",
    isPublished: true,
    kind: "explanation",
    organizationId,
    position: 0,
    slug: `e2e-free-lesson-${uniqueId}`,
    title: `E2E Free Lesson ${uniqueId}`,
  });

  await stepFixture({
    content: {
      text: `Free lesson content ${uniqueId}`,
      title: `Free lesson step ${uniqueId}`,
      variant: "text",
    },
    isPublished: true,
    lessonId: lesson.id,
  });

  return { chapter, lesson };
}

/**
 * Builds two playable lessons so the player can prove its quiet skip action
 * follows the real published curriculum order instead of a test-only route.
 */
async function createPlayerSkipScenario() {
  const scenario = await createTestLesson({ generationStatus: "completed", lessonPosition: 0 });

  const nextLesson = await lessonFixture({
    chapterId: scenario.chapter.id,
    generationStatus: "completed",
    isPublished: true,
    kind: "explanation",
    organizationId: scenario.lesson.organizationId,
    position: 1,
    slug: `e2e-skip-next-lesson-${scenario.uniqueId}`,
    title: `E2E Skip Next Lesson ${scenario.uniqueId}`,
  });

  await stepFixture({
    content: {
      text: `Next lesson content ${scenario.uniqueId}`,
      title: `Next lesson step ${scenario.uniqueId}`,
      variant: "text",
    },
    isPublished: true,
    lessonId: nextLesson.id,
  });

  return { ...scenario, nextLesson };
}

async function expectGuestProgressWarning(page: Page) {
  await expect(page.getByRole("heading", { name: "Progress won't be saved" })).toBeVisible();
}

async function continueWithoutSaving(page: Page) {
  await expectGuestProgressWarning(page);
  await page.getByRole("button", { name: "Continue without saving" }).click();
}

/**
 * Lesson metadata streams after the initial document, so SEO assertions need
 * to poll the rendered head instead of reading it immediately after navigation.
 */
async function expectRobotsMeta({ page, value }: { page: Page; value: string }) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.querySelector<HTMLMetaElement>("meta[name='robots']")?.content ?? "",
      ),
    )
    .toBe(value);
}

/**
 * Practice lessons can be generated from explanation metadata before those
 * explanations finish generating, so the player empty state should point at
 * the practice lesson itself instead of sending learners to an explanation row.
 */
async function createPracticeWithPendingExplanation() {
  const org = await getAiOrganization();

  const uniqueId = randomUUID().slice(0, 8);
  const sourceTitle = `E2E Blocked Player Explanation ${uniqueId}`;

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-blocked-player-course-${uniqueId}`,
    title: `E2E Blocked Player Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-blocked-player-chapter-${uniqueId}`,
    title: `E2E Blocked Player Chapter ${uniqueId}`,
  });

  const [, practice] = await Promise.all([
    lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: "explanation",
      organizationId: org.id,
      position: 0,
      slug: `e2e-blocked-player-explanation-${uniqueId}`,
      title: sourceTitle,
    }),
    lessonFixture({
      chapterId: chapter.id,
      description: null,
      generationStatus: "pending",
      isPublished: true,
      kind: "practice",
      organizationId: org.id,
      position: 1,
      slug: `e2e-blocked-player-practice-${uniqueId}`,
      title: null,
    }),
  ]);

  return { chapter, course, practice, sourceTitle };
}

async function createPendingCompanionLesson({
  sourceKind,
  targetKind,
}: {
  sourceKind: "reading" | "vocabulary";
  targetKind: "listening" | "translation";
}) {
  const org = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    language: "en",
    organizationId: org.id,
    slug: `e2e-companion-player-course-${uniqueId}`,
    targetLanguage: "de",
    title: `E2E Companion Player Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    language: "en",
    organizationId: org.id,
    slug: `e2e-companion-player-chapter-${uniqueId}`,
    title: `E2E Companion Player Chapter ${uniqueId}`,
  });

  const [sourceLesson, companionLesson] = await Promise.all([
    lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      kind: sourceKind,
      organizationId: org.id,
      position: 0,
      slug: `e2e-source-${sourceKind}-${uniqueId}`,
      title: `E2E Source ${sourceKind} ${uniqueId}`,
    }),
    lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: targetKind,
      organizationId: org.id,
      position: 1,
      slug: `e2e-companion-${targetKind}-${uniqueId}`,
      title: `E2E Companion ${targetKind} ${uniqueId}`,
    }),
  ]);

  await stepFixture({
    content: {
      text: `Source companion step ${uniqueId}`,
      title: `Source ${sourceKind} ${uniqueId}`,
      variant: "text",
    },
    isPublished: true,
    kind: "static",
    lessonId: sourceLesson.id,
  });

  return { chapter, companionLesson, course, sourceLesson };
}

/**
 * Review lessons are completed structural rows, but they only have playable
 * content after earlier generated lessons have saved reviewable steps.
 */
async function createEmptyReviewLesson() {
  const org = await getAiOrganization();

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-review-empty-course-${uniqueId}`,
    title: `E2E Review Empty Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-review-empty-chapter-${uniqueId}`,
    title: `E2E Review Empty Chapter ${uniqueId}`,
  });

  const [requiredLesson, review] = await Promise.all([
    lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: "explanation",
      organizationId: org.id,
      position: 0,
      slug: `e2e-review-empty-explanation-${uniqueId}`,
      title: `E2E Review Empty Explanation ${uniqueId}`,
    }),
    lessonFixture({
      chapterId: chapter.id,
      description: null,
      generationStatus: "completed",
      isPublished: true,
      kind: "review",
      organizationId: org.id,
      position: 1,
      slug: `e2e-review-empty-review-${uniqueId}`,
      title: null,
    }),
  ]);

  return { chapter, course, requiredLesson, review };
}

/**
 * Translation lessons reuse word IDs from a vocabulary lesson without copying
 * the lesson-scoped translation rows. The player page must therefore hydrate
 * translation options from the vocabulary source lesson.
 */
async function createDerivedTranslationLesson() {
  const org = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    language: "en",
    organizationId: org.id,
    slug: `e2e-derived-translation-course-${uniqueId}`,
    targetLanguage: "de",
    title: `E2E Derived Translation Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    language: "en",
    organizationId: org.id,
    slug: `e2e-derived-translation-chapter-${uniqueId}`,
    title: `E2E Derived Translation Chapter ${uniqueId}`,
  });

  const [sourceLesson, translationLesson, readingLesson, reviewLesson, correctWord] =
    await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "vocabulary",
        organizationId: org.id,
        position: 0,
        slug: `e2e-source-vocabulary-${uniqueId}`,
        title: `E2E Source Vocabulary ${uniqueId}`,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "translation",
        organizationId: org.id,
        position: 1,
        slug: `e2e-derived-translation-${uniqueId}`,
        title: `E2E Derived Translation ${uniqueId}`,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "reading",
        organizationId: org.id,
        position: 2,
        slug: `e2e-derived-translation-reading-${uniqueId}`,
        title: `E2E Derived Translation Reading ${uniqueId}`,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "review",
        organizationId: org.id,
        position: 3,
        slug: `e2e-derived-translation-review-${uniqueId}`,
        title: `E2E Derived Translation Review ${uniqueId}`,
      }),
      wordFixture({ organizationId: org.id, targetLanguage: "de", word: `richtig-${uniqueId}` }),
    ]);

  const readingSentence = await sentenceFixture({
    organizationId: org.id,
    sentence: correctWord.word,
    targetLanguage: "de",
  });

  const [sourceChapterWord, , readingChapterSentence] = await Promise.all([
    chapterWordFixture({
      distractors: [`falsch-${uniqueId}`],
      sourceLessonId: sourceLesson.id,
      translation: `Correct-${uniqueId}`,
      userLanguage: "en",
      wordId: correctWord.id,
    }),
    chapterWordFixture({
      distractors: [],
      sourceLessonId: readingLesson.id,
      translation: `correct-${uniqueId}`,
      userLanguage: "en",
      wordId: correctWord.id,
    }),
    chapterSentenceFixture({
      sentenceId: readingSentence.id,
      sourceLessonId: readingLesson.id,
      translation: `correct-${uniqueId}`,
      userLanguage: "en",
    }),
  ]);

  await Promise.all([
    stepFixture({
      chapterWordId: sourceChapterWord.id,
      content: {},
      isPublished: true,
      kind: "translation",
      lessonId: translationLesson.id,
      wordId: correctWord.id,
    }),
    stepFixture({
      chapterSentenceId: readingChapterSentence.id,
      content: {},
      isPublished: true,
      kind: "reading",
      lessonId: readingLesson.id,
      sentenceId: readingSentence.id,
    }),
  ]);

  return {
    correctOption: correctWord.word,
    distractorOption: `falsch-${uniqueId}`,
    prompt: `Correct-${uniqueId}`,
    reviewUrl: `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${reviewLesson.slug}`,
    url: `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${translationLesson.slug}`,
  };
}

/**
 * Review steps are intentionally shuffled. If the mixed-resource review opens
 * on the reading filler step first, this advances through it so the test can
 * assert the translation step that regressed in production data.
 */
async function showReviewTranslationStep({
  page,
  prompt,
  readingAnswer,
}: {
  page: Page;
  prompt: string;
  readingAnswer: string;
}) {
  const promptText = page.getByText(prompt);
  const options = page.getByRole("radiogroup", { name: /answer options/iu });
  const wordBank = page.getByRole("group", { name: /word bank/iu });

  await expect(options.or(wordBank)).toBeVisible();

  if (await options.isVisible()) {
    await expect(promptText).toBeVisible();
    return;
  }

  await expect(wordBank).toBeVisible();

  await wordBank.getByRole("button", { exact: true, name: readingAnswer }).click();
  await page.getByRole("button", { name: /check/iu }).click();
  await expect(page.getByRole("button", { name: /continue/iu })).toBeVisible();
  await page.getByRole("button", { name: /continue/iu }).click();

  await expect(promptText).toBeVisible();
  await expect(options).toBeVisible();
}

/**
 * Listening lessons reuse the exact chapter-sentence row generated by reading.
 * The word bank must use that row's translation and translation distractors.
 */
async function createDerivedListeningLesson() {
  const org = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    language: "en",
    organizationId: org.id,
    slug: `e2e-derived-listening-course-${uniqueId}`,
    targetLanguage: "de",
    title: `E2E Derived Listening Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    language: "en",
    organizationId: org.id,
    slug: `e2e-derived-listening-chapter-${uniqueId}`,
    title: `E2E Derived Listening Chapter ${uniqueId}`,
  });

  const [sourceLesson, listeningLesson, reviewLesson, sentence] = await Promise.all([
    lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      kind: "reading",
      organizationId: org.id,
      position: 0,
      slug: `e2e-source-reading-${uniqueId}`,
      title: `E2E Source Reading ${uniqueId}`,
    }),
    lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      kind: "listening",
      organizationId: org.id,
      position: 1,
      slug: `e2e-derived-listening-${uniqueId}`,
      title: `E2E Derived Listening ${uniqueId}`,
    }),
    lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      kind: "review",
      organizationId: org.id,
      position: 2,
      slug: `e2e-derived-listening-review-${uniqueId}`,
      title: `E2E Derived Listening Review ${uniqueId}`,
    }),
    sentenceFixture({
      organizationId: org.id,
      sentence: `Guten Morgen ${uniqueId}`,
      targetLanguage: "de",
    }),
  ]);

  const chapterSentence = await chapterSentenceFixture({
    sentenceId: sentence.id,
    sourceLessonId: sourceLesson.id,
    translation: `hello-${uniqueId} world-${uniqueId}`,
    translationDistractors: [`again-${uniqueId}`],
    userLanguage: "en",
  });

  await stepFixture({
    chapterSentenceId: chapterSentence.id,
    content: {},
    isPublished: true,
    kind: "listening",
    lessonId: listeningLesson.id,
    sentenceId: sentence.id,
  });

  return {
    distractor: `again-${uniqueId}`,
    firstWord: `hello-${uniqueId}`,
    reviewUrl: `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${reviewLesson.slug}`,
    secondWord: `world-${uniqueId}`,
    url: `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${listeningLesson.slug}`,
  };
}

test.describe("Lesson Player Page", () => {
  test("unauthenticated users can play every lesson in the first chapter", async ({ page }) => {
    const { chapter, course, lesson, uniqueId } = await createTestLesson({
      generationStatus: "completed",
      lessonPosition: 99,
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);
    await continueWithoutSaving(page);

    await expect(page.getByRole("heading", { name: `Step ${uniqueId} #0` })).toBeVisible();
    await expect(page.getByText(`Test step content ${uniqueId} #0`)).toBeVisible();
  });

  test("authenticated users without subscription can play every lesson in the first chapter", async ({
    authenticatedPage,
  }) => {
    const { chapter, course, lesson, uniqueId } = await createTestLesson({
      generationStatus: "completed",
      lessonPosition: 99,
    });

    await authenticatedPage.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(
      authenticatedPage.getByRole("heading", { name: `Step ${uniqueId} #0` }),
    ).toBeVisible();
  });

  test("lesson options let the learner skip to the next lesson", async ({ authenticatedPage }) => {
    const { chapter, course, lesson, nextLesson } = await createPlayerSkipScenario();

    await authenticatedPage.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(authenticatedPage.getByRole("link", { name: "Skip lesson" })).not.toBeVisible();

    await authenticatedPage.getByRole("button", { name: "Lesson options" }).click();
    await authenticatedPage.getByRole("link", { name: "Skip lesson" }).click();

    await expect(authenticatedPage).toHaveURL(new RegExp(`/l/${nextLesson.slug}$`, "u"));
  });

  test("formats lesson progress using the app locale", async ({ browser, withProgressUser }) => {
    const { chapter, course, lesson, uniqueId } = await createTestLesson({
      generationStatus: "completed",
      stepCount: 2,
    });

    const browserContext = await browser.newContext({
      locale: "en-US",
      storageState: withProgressUser.storageState,
    });

    const page = await browserContext.newPage();

    try {
      await page.goto(`/de/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);
      await expect(page.getByRole("heading", { name: `Step ${uniqueId} #0` })).toBeVisible();

      await expect(page.getByRole("progressbar", { name: "Lektionsfortschritt" })).toHaveAttribute(
        "aria-valuetext",
        new Intl.NumberFormat("de", { style: "percent" }).format(0.5),
      );
    } finally {
      await browserContext.close();
    }
  });

  test("subscription gate offers the free first chapter for later lessons", async ({
    authenticatedPage,
  }) => {
    const { chapter, course, lesson, lessonTitle, organizationId, uniqueId } =
      await createTestLesson({
        chapterPosition: 1,
        generationStatus: "completed",
        lessonPosition: 0,
      });

    const { chapter: freeChapter, lesson: freeLesson } = await freeFirstLessonFixture({
      courseId: course.id,
      organizationId,
      uniqueId,
    });

    const lessonHref = `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`;
    const chapterHref = `/b/ai/c/${course.slug}/ch/${chapter.slug}`;
    const freeLessonHref = `/b/ai/c/${course.slug}/ch/${freeChapter.slug}/l/${freeLesson.slug}`;

    await authenticatedPage.goto(lessonHref);

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: lessonTitle }),
    ).toBeVisible();

    await expect(authenticatedPage.getByText(`E2E lesson description ${uniqueId}`)).toBeVisible();

    await expect(authenticatedPage.getByText("This lesson is included with Plus.")).toBeVisible();

    const backLink = authenticatedPage.getByRole("link", { name: /back to chapter/iu });
    const freeChapterLink = authenticatedPage.getByRole("link", { name: /^try free chapter$/iu });
    const upgradeLink = authenticatedPage.getByRole("link", { name: /^subscribe$/iu });

    await expect(backLink).toBeVisible();
    await expect(backLink.getByText(/^Esc$/u)).toBeVisible();
    await expect(backLink).toHaveAttribute("aria-keyshortcuts", "Escape");
    await expect(backLink).toHaveAttribute("href", chapterHref);

    await expect(freeChapterLink).toBeVisible();
    await expect(freeChapterLink).toHaveAttribute("href", freeLessonHref);

    await expect(upgradeLink).toBeVisible();
    await expect(upgradeLink.getByText(/^Enter$/u)).toBeVisible();
    await expect(upgradeLink).toHaveAttribute("aria-keyshortcuts", "Enter");
    await expect(upgradeLink).toHaveAttribute("href", "/subscription");

    await freeChapterLink.click();

    await expect(
      authenticatedPage.getByRole("heading", { name: `Free lesson step ${uniqueId}` }),
    ).toBeVisible();

    await authenticatedPage.goto(lessonHref);
    await expect(backLink).toBeVisible();

    await pressShortcutAndWaitForUrl({
      expectedUrl: chapterHref,
      key: "Escape",
      page: authenticatedPage,
    });

    await authenticatedPage.goto(lessonHref);

    await expect(authenticatedPage.getByRole("link", { name: /^subscribe$/iu })).toBeVisible();

    await pressShortcutAndWaitForUrl({
      expectedUrl: "/subscription",
      key: "Enter",
      page: authenticatedPage,
    });
  });

  test("close link preserves the active language", async ({ authenticatedPage }) => {
    const { chapter, course, lesson } = await createTestLesson({ generationStatus: "completed" });
    const chapterPath = `/b/ai/c/${course.slug}/ch/${chapter.slug}`;

    await setLocale(authenticatedPage, "pt");
    await authenticatedPage.goto(`${chapterPath}/l/${lesson.slug}`);

    await expect(authenticatedPage).toHaveURL(
      new RegExp(`/pt${chapterPath}/l/${lesson.slug}$`, "u"),
    );

    const closeLink = authenticatedPage.getByRole("link", { name: /fechar/iu });

    await expect(closeLink).toHaveAttribute("href", `/pt${chapterPath}`);
  });

  test("pending lessons show the create state and link details", async ({ page }) => {
    const { lesson, chapter, course, lessonTitle, uniqueId } = await createTestLesson({
      generationStatus: "pending",
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(page.getByRole("heading", { level: 1, name: lessonTitle })).toBeVisible();
    await expect(page.getByText(`E2E lesson description ${uniqueId}`)).toBeVisible();

    await expect(
      page.getByText(
        "This lesson is part of the course, but it hasn't been created yet. Create it to start learning.",
      ),
    ).toBeVisible();

    const generateLink = page.getByRole("link", { name: /create lesson/iu });

    await expect(generateLink).toBeVisible();
    await expect(generateLink.getByText(/^N$/u)).toBeVisible();
    await expect(generateLink).toHaveAttribute("aria-keyshortcuts", "n");
    await expect(generateLink).toHaveAttribute("href", new RegExp(`/generate/l/${lesson.id}`, "u"));
    await expect(generateLink).toHaveAttribute("rel", "nofollow");

    const chapterLink = page.getByRole("link", { name: /back to chapter/iu });
    await expect(chapterLink).toBeVisible();
    await expect(chapterLink.getByText(/^Esc$/u)).toBeVisible();
    await expect(chapterLink).toHaveAttribute("aria-keyshortcuts", "Escape");

    await expect(chapterLink).toHaveAttribute("href", `/b/ai/c/${course.slug}/ch/${chapter.slug}`);

    await pressShortcutAndWaitForUrl({
      expectedUrl: new RegExp(`/generate/l/${lesson.id}`, "u"),
      key: "n",
      page,
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);
    await expect(page.getByRole("link", { name: /back to chapter/iu })).toBeVisible();

    await pressShortcutAndWaitForUrl({
      expectedUrl: `/b/ai/c/${course.slug}/ch/${chapter.slug}`,
      key: "Escape",
      page,
    });
  });

  test("pending practice lessons link to their own generation page", async ({
    authenticatedPage,
  }) => {
    const { chapter, course, practice, sourceTitle } = await createPracticeWithPendingExplanation();

    await authenticatedPage.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${practice.slug}`);

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: sourceTitle }),
    ).toBeVisible();

    await expect(
      authenticatedPage.getByText(
        `Apply ${sourceTitle} through a visual real-world problem with short decisions.`,
      ),
    ).toBeVisible();

    await expect(
      authenticatedPage.getByText(
        "This lesson is part of the course, but it hasn't been created yet. Create it to start learning.",
      ),
    ).toBeVisible();

    const generateLink = authenticatedPage.getByRole("link", { name: "Create lesson" });

    await expect(generateLink).toBeVisible();
    await expect(generateLink).toHaveAttribute("href", `/generate/l/${practice.id}`);
    await expect(generateLink).toHaveAttribute("rel", "nofollow");
  });

  test("pending translation player redirects to source vocabulary player", async ({ page }) => {
    const { chapter, companionLesson, course, sourceLesson } = await createPendingCompanionLesson({
      sourceKind: "vocabulary",
      targetKind: "translation",
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${companionLesson.slug}`);

    await expect(page).toHaveURL(
      new RegExp(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${sourceLesson.slug}$`, "u"),
    );
  });

  test("pending listening player redirects to source reading player", async ({ page }) => {
    const { chapter, companionLesson, course, sourceLesson } = await createPendingCompanionLesson({
      sourceKind: "reading",
      targetKind: "listening",
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${companionLesson.slug}`);

    await expect(page).toHaveURL(
      new RegExp(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${sourceLesson.slug}$`, "u"),
    );
  });

  test("empty review lessons link to the first earlier lesson that needs generation", async ({
    authenticatedPage,
  }) => {
    const { chapter, course, requiredLesson, review } = await createEmptyReviewLesson();

    await authenticatedPage.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${review.slug}`);

    await expect(authenticatedPage).toHaveTitle(new RegExp(`${chapter.title} Review`, "u"));
    await expectRobotsMeta({ page: authenticatedPage, value: "index, follow" });

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: chapter.title }),
    ).toBeVisible();

    await expect(
      authenticatedPage.getByText(
        `Review everything you learned about ${chapter.title} with a comprehensive quiz.`,
      ),
    ).toBeVisible();

    await expect(
      authenticatedPage.getByText(
        "Review unlocks after the earlier lessons in this chapter have been created.",
      ),
    ).toBeVisible();

    const requiredLessonLink = authenticatedPage.getByRole("link", { name: "Create lesson" });

    await expect(requiredLessonLink).toBeVisible();
    await expect(requiredLessonLink).toHaveAttribute("href", `/generate/l/${requiredLesson.id}`);
    await expect(requiredLessonLink).toHaveAttribute("rel", "nofollow");
  });

  test("derived translation lessons show source vocabulary distractors", async ({
    authenticatedPage,
  }) => {
    const { correctOption, distractorOption, prompt, url } = await createDerivedTranslationLesson();

    await authenticatedPage.goto(url);

    await expect(authenticatedPage.getByText(prompt)).toBeVisible();

    const options = authenticatedPage.getByRole("radiogroup", { name: /answer options/iu });
    await expect(options.getByRole("radio", { name: correctOption })).toBeVisible();
    await expect(options.getByRole("radio", { name: distractorOption })).toBeVisible();
  });

  test("derived listening lessons show source reading word banks", async ({
    authenticatedPage,
  }) => {
    const { distractor, firstWord, secondWord, url } = await createDerivedListeningLesson();

    await authenticatedPage.goto(url);

    const wordBank = authenticatedPage.getByRole("group", { name: /word bank/iu });
    await expect(wordBank.getByRole("button", { name: firstWord })).toBeVisible();
    await expect(wordBank.getByRole("button", { name: secondWord })).toBeVisible();
    await expect(wordBank.getByRole("button", { name: distractor })).toBeVisible();
  });

  test("review translation steps show source vocabulary distractors", async ({
    authenticatedPage,
  }) => {
    const { correctOption, distractorOption, prompt, reviewUrl } =
      await createDerivedTranslationLesson();

    await authenticatedPage.goto(reviewUrl);

    await showReviewTranslationStep({
      page: authenticatedPage,
      prompt,
      readingAnswer: correctOption,
    });

    const options = authenticatedPage.getByRole("radiogroup", { name: /answer options/iu });
    await expect(options.getByRole("radio", { name: correctOption })).toBeVisible();
    await expect(options.getByRole("radio", { name: distractorOption })).toBeVisible();
  });

  test("review listening steps show source reading word banks", async ({ authenticatedPage }) => {
    const { distractor, firstWord, reviewUrl, secondWord } = await createDerivedListeningLesson();

    await authenticatedPage.goto(reviewUrl);

    const wordBank = authenticatedPage.getByRole("group", { name: /word bank/iu });
    await expect(wordBank.getByRole("button", { name: firstWord })).toBeVisible();
    await expect(wordBank.getByRole("button", { name: secondWord })).toBeVisible();
    await expect(wordBank.getByRole("button", { name: distractor })).toBeVisible();
  });

  test("pending non-AI lessons do not show a generate link", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const org = await createOrganization();

    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
      slug: `non-ai-lesson-course-${uniqueId}`,
      title: `Non AI Lesson Course ${uniqueId}`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
      slug: `non-ai-lesson-chapter-${uniqueId}`,
      title: `Non AI Lesson Chapter ${uniqueId}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      organizationId: org.id,
      slug: `non-ai-lesson-lesson-${uniqueId}`,
      title: `Non AI Lesson Lesson ${uniqueId}`,
    });

    await page.goto(`/b/${org.slug}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(page.getByRole("heading", { level: 1, name: lesson.title! })).toBeVisible();

    await expect(
      page.getByText(
        "This lesson is part of the course, but it hasn't been created yet. Create it to start learning.",
      ),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: /create lesson/iu })).not.toBeVisible();
  });

  test("pressing escape navigates to the chapter page", async ({ page }) => {
    const { chapter, course, lesson } = await createTestLesson({ generationStatus: "completed" });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expectGuestProgressWarning(page);

    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Escape");

    await expect(page).toHaveURL(new RegExp(`/b/ai/c/${course.slug}/ch/${chapter.slug}$`, "u"));
  });

  test("non-existent lesson shows 404 page", async ({ page }) => {
    const { chapter, course, uniqueId } = await createTestLesson();

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/missing-${uniqueId}`);

    await expect(page.getByText(/not found|404/iu)).toBeVisible();
  });

  test("uses stored lesson metadata and permits indexing", async ({ page }) => {
    const { chapter, course, lesson, lessonTitle, uniqueId } = await createTestLesson({
      generationStatus: "completed",
    });

    await page.goto(`/pt/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(page).toHaveTitle(new RegExp(`${lessonTitle}.*:.*${course.title}`, "u"));

    await expect
      .poll(() =>
        page.evaluate(
          () => document.querySelector<HTMLMetaElement>("meta[name='description']")?.content ?? "",
        ),
      )
      .toMatch(
        new RegExp(`${lessonTitle}.*${course.title}.*E2E lesson description ${uniqueId}`, "u"),
      );

    await expectRobotsMeta({ page, value: "index, follow" });
  });

  test("page title uses the source topic for an indexable companion lesson", async ({ page }) => {
    const org = await getAiOrganization();
    const uniqueId = randomUUID().slice(0, 8);

    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-titleless-course-${uniqueId}`,
      title: `E2E Titleless Course ${uniqueId}`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-titleless-chapter-${uniqueId}`,
      title: `E2E Titleless Chapter ${uniqueId}`,
    });

    const sourceTitle = `E2E Source Topic ${uniqueId}`;

    const [sourceLesson, lesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "explanation",
        organizationId: org.id,
        position: 0,
        slug: `e2e-source-explanation-${uniqueId}`,
        title: sourceTitle,
      }),
      lessonFixture({
        chapterId: chapter.id,
        description: null,
        generationStatus: "completed",
        isPublished: true,
        kind: "quiz",
        organizationId: org.id,
        position: 1,
        slug: `e2e-titleless-quiz-${uniqueId}`,
        title: null,
      }),
    ]);

    await Promise.all([
      stepFixture({
        content: {
          text: `Source explanation step ${uniqueId}`,
          title: `Source explanation ${uniqueId}`,
          variant: "text",
        },
        isPublished: true,
        lessonId: sourceLesson.id,
      }),
      stepFixture({
        content: {
          text: `Titleless quiz step ${uniqueId}`,
          title: `Titleless quiz ${uniqueId}`,
          variant: "text",
        },
        isPublished: true,
        lessonId: lesson.id,
      }),
    ]);

    await page.goto(`/pt/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(page).toHaveTitle(new RegExp(`${sourceTitle}.*:.*${course.title}`, "u"));

    await expect(page).not.toHaveTitle(/Quiz Quiz/u);
  });

  test("permits indexing for lessons in later chapters", async ({ page }) => {
    const { chapter, course, lesson } = await createTestLesson({
      chapterPosition: 1,
      generationStatus: "completed",
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expectRobotsMeta({ page, value: "index, follow" });
  });

  test("unpublished lesson shows 404 page", async ({ page }) => {
    const org = await getAiOrganization();

    const uniqueId = randomUUID().slice(0, 8);

    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-unpub-lesson-course-${uniqueId}`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-unpub-lesson-chapter-${uniqueId}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: false,
      organizationId: org.id,
      slug: `e2e-unpub-lesson-lesson-${uniqueId}`,
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(page.getByText(/not found|404/iu)).toBeVisible();
  });
});
