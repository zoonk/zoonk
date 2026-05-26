import { randomUUID } from "node:crypto";
import { createOrganization, getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { chapterSentenceFixture, sentenceFixture } from "@zoonk/testing/fixtures/sentences";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { chapterWordFixture, wordFixture } from "@zoonk/testing/fixtures/words";
import { type Page, expect, test } from "./fixtures";

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

  return { chapter, course, lesson, lessonTitle, uniqueId };
}

/**
 * A practice lesson depends on the explanation lessons before it. This creates
 * the smallest published AI chapter where the practice player page should send
 * the learner to the missing explanation's generation page instead of starting
 * practice generation.
 */
async function createBlockedPracticeLesson() {
  const org = await getAiOrganization();

  const uniqueId = randomUUID().slice(0, 8);

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

  const [explanation, practice] = await Promise.all([
    lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: "explanation",
      organizationId: org.id,
      position: 0,
      slug: `e2e-blocked-player-explanation-${uniqueId}`,
      title: `E2E Blocked Player Explanation ${uniqueId}`,
    }),
    lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: "practice",
      organizationId: org.id,
      position: 1,
      slug: `e2e-blocked-player-practice-${uniqueId}`,
      title: `E2E Blocked Player Practice ${uniqueId}`,
    }),
  ]);

  return { chapter, course, explanation, practice };
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
      generationStatus: "completed",
      isPublished: true,
      kind: "review",
      organizationId: org.id,
      position: 1,
      slug: `e2e-review-empty-review-${uniqueId}`,
      title: `E2E Review Empty Review ${uniqueId}`,
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
  test("unauthenticated users can play the first lesson of the first chapter", async ({ page }) => {
    const { chapter, course, lesson, uniqueId } = await createTestLesson({
      generationStatus: "completed",
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(page.getByRole("heading", { name: `Step ${uniqueId} #0` })).toBeVisible();
    await expect(page.getByText(`Test step content ${uniqueId} #0`)).toBeVisible();
  });

  test("unauthenticated users see login prompt for later lessons", async ({ page }) => {
    const { chapter, course, lesson } = await createTestLesson({
      generationStatus: "completed",
      lessonPosition: 1,
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(page.getByRole("alert").filter({ hasText: /logged in/iu })).toBeVisible();

    const loginLink = page.getByRole("link", { name: /login/iu });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute("href", "/login");
  });

  test("close link has correct href", async ({ page }) => {
    const { chapter, course, lesson } = await createTestLesson({ generationStatus: "completed" });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    const closeLink = page.getByRole("link", { name: /close/iu });

    await expect(closeLink).toHaveAttribute(
      "href",
      new RegExp(`/b/ai/c/${course.slug}/ch/${chapter.slug}$`, "u"),
    );
  });

  test("pending lessons show the create state and link details", async ({ page }) => {
    const { lesson, chapter, course } = await createTestLesson({ generationStatus: "pending" });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(page.getByText(/lesson not available/iu)).toBeVisible();
    await expect(page.getByText(/hasn't been created yet/iu)).toBeVisible();
    const generateLink = page.getByRole("link", { name: /create lesson/iu });

    await expect(generateLink).toBeVisible();
    await expect(generateLink).toHaveAttribute("href", new RegExp(`/generate/l/${lesson.id}`, "u"));
    await expect(generateLink).toHaveAttribute("rel", "nofollow");

    const chapterLink = page.getByRole("link", { name: /back to chapter/iu });
    await expect(chapterLink).toBeVisible();

    await expect(chapterLink).toHaveAttribute("href", `/b/ai/c/${course.slug}/ch/${chapter.slug}`);
  });

  test("blocked practice lessons link to the required explanation generation page", async ({
    authenticatedPage,
  }) => {
    const { chapter, course, explanation, practice } = await createBlockedPracticeLesson();

    await authenticatedPage.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${practice.slug}`);

    await expect(authenticatedPage.getByText("Lesson locked")).toBeVisible();
    await expect(authenticatedPage.getByText("Create the required lesson first.")).toBeVisible();

    const requiredLessonLink = authenticatedPage.getByRole("link", {
      name: "Open required lesson",
    });

    await expect(requiredLessonLink).toBeVisible();
    await expect(requiredLessonLink).toHaveAttribute("href", `/generate/l/${explanation.id}`);
    await expect(requiredLessonLink).toHaveAttribute("rel", "nofollow");
  });

  test("empty review lessons link to the first earlier lesson that needs generation", async ({
    authenticatedPage,
  }) => {
    const { chapter, course, requiredLesson, review } = await createEmptyReviewLesson();

    await authenticatedPage.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${review.slug}`);

    await expect(authenticatedPage.getByText("Review locked")).toBeVisible();

    await expect(
      authenticatedPage.getByText("Create earlier lessons first, then come back to review."),
    ).toBeVisible();

    const requiredLessonLink = authenticatedPage.getByRole("link", {
      name: "Open required lesson",
    });

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

    await expect(page.getByText(/lesson not available/iu)).toBeVisible();
    await expect(page.getByRole("link", { name: /create lesson/iu })).not.toBeVisible();
  });

  test("pressing escape navigates to the chapter page", async ({ page }) => {
    const { chapter, course, lesson } = await createTestLesson({ generationStatus: "completed" });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(page.getByRole("link", { name: /close/iu })).toBeVisible();

    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Escape");

    await expect(page).toHaveURL(new RegExp(`/b/ai/c/${course.slug}/ch/${chapter.slug}$`, "u"));
  });

  test("non-existent lesson shows 404 page", async ({ page }) => {
    const { chapter, course, uniqueId } = await createTestLesson();

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/missing-${uniqueId}`);

    await expect(page.getByText(/not found|404/iu)).toBeVisible();
  });

  test("page title contains lesson title", async ({ page }) => {
    const { chapter, course, lesson, lessonTitle } = await createTestLesson({
      generationStatus: "completed",
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(page).toHaveTitle(new RegExp(lessonTitle, "u"));
  });

  test("page title describes lessons without a stored title", async ({ authenticatedPage }) => {
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

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      kind: "quiz",
      organizationId: org.id,
      position: 2,
      slug: `e2e-titleless-quiz-${uniqueId}`,
      title: null,
    });

    await stepFixture({
      content: {
        text: `Titleless quiz step ${uniqueId}`,
        title: `Titleless quiz ${uniqueId}`,
        variant: "text",
      },
      isPublished: true,
      lessonId: lesson.id,
    });

    await authenticatedPage.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(authenticatedPage).toHaveTitle(
      new RegExp(`${chapter.title} Quiz ${lesson.position + 1}`, "u"),
    );

    await expect(authenticatedPage).not.toHaveTitle(/Quiz Quiz/u);
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
