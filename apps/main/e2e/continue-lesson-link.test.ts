import { randomUUID } from "node:crypto";
import { type Browser } from "@playwright/test";
import { type LessonKind, prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture, courseUserFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { type Page, expect, test } from "./fixtures";

type ContinueActionLabel = "Continue" | "Review" | "Start";

/**
 * Continue buttons expose the compact progress suffix in their accessible
 * names, so route-focused tests should match the action while allowing the
 * optional progress details appended after it.
 */
function getContinueActionLink({ label, page }: { label: ContinueActionLabel; page: Page }) {
  return page.getByRole("link", { name: getContinueActionName({ label }) });
}

/**
 * The no-progress course page is now a landing page, so its first action uses
 * the lower-commitment copy while still reusing the continue-link routing.
 */
function getStartFreeChapterLink({ page }: { page: Page }) {
  return page.getByRole("link", { name: /^try free chapter$/iu });
}

/**
 * The progress suffix differs by scope: courses announce chapters while
 * chapters announce lessons. These tests only need the CTA action, so this
 * helper keeps that accessible-name detail in one place.
 */
function getContinueActionName({ label }: { label: ContinueActionLabel }) {
  return new RegExp(`^${label}(?: \\d+% complete)?$`, "iu");
}

async function createTestCourseWithLesson() {
  const org = await getAiOrganization();

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-cal-course-${uniqueId}`,
    title: `E2E CAL Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    slug: `e2e-cal-ch-${uniqueId}`,
    title: `E2E CAL Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    generationStatus: "completed",
    isPublished: true,
    kind: "explanation",
    organizationId: org.id,
    position: 0,
    slug: `e2e-cal-l-${uniqueId}`,
    title: `E2E CAL Lesson ${uniqueId}`,
  });

  return { chapter, course, lesson, org };
}

async function createTestCourseWithoutPlayableSteps() {
  const org = await getAiOrganization();

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-cal-no-steps-${uniqueId}`,
    title: `E2E CAL No Steps ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    slug: `e2e-cal-no-steps-ch-${uniqueId}`,
    title: `E2E CAL No Steps Ch ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    slug: `e2e-cal-no-steps-l-${uniqueId}`,
    title: `E2E CAL No Steps Lesson ${uniqueId}`,
  });

  return { chapter, course, lesson };
}

async function createTestCourseWithPendingFirstLesson() {
  const org = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-cal-pending-course-${uniqueId}`,
    title: `E2E CAL Pending Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    slug: `e2e-cal-pending-ch-${uniqueId}`,
    title: `E2E CAL Pending Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    generationStatus: "pending",
    isPublished: true,
    kind: "explanation",
    organizationId: org.id,
    position: 0,
    slug: `e2e-cal-pending-l-${uniqueId}`,
    title: `E2E CAL Pending Lesson ${uniqueId}`,
  });

  return { chapter, course, lesson };
}

/**
 * Review-link tests need a course where the first chapter can be either
 * partially or fully complete, and the final chapter ends with a review lesson.
 * That lets the assertions distinguish missing work, chapter review, and
 * course review without repeating catalog setup in each test.
 */
async function createTestCourseWithReviewChapters() {
  const org = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-cal-review-course-${uniqueId}`,
    title: `E2E CAL Review Course ${uniqueId}`,
  });

  const [firstChapter, secondChapter] = await Promise.all([
    chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
      position: 0,
      slug: `e2e-cal-review-ch1-${uniqueId}`,
      title: `E2E CAL Review Ch1 ${uniqueId}`,
    }),
    chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
      position: 1,
      slug: `e2e-cal-review-ch2-${uniqueId}`,
      title: `E2E CAL Review Ch2 ${uniqueId}`,
    }),
  ]);

  const [firstLesson, firstMiddleLesson, firstReviewLesson, secondLesson, secondReviewLesson] =
    await Promise.all([
      lessonFixture({
        chapterId: firstChapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: org.id,
        position: 0,
        slug: `e2e-cal-review-l1-${uniqueId}`,
        title: `E2E CAL Review L1 ${uniqueId}`,
      }),
      lessonFixture({
        chapterId: firstChapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: org.id,
        position: 1,
        slug: `e2e-cal-review-l1b-${uniqueId}`,
        title: `E2E CAL Review L1B ${uniqueId}`,
      }),
      lessonFixture({
        chapterId: firstChapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "review",
        organizationId: org.id,
        position: 2,
        slug: `e2e-cal-review-r1-${uniqueId}`,
        title: `E2E CAL Review R1 ${uniqueId}`,
      }),
      lessonFixture({
        chapterId: secondChapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: org.id,
        position: 0,
        slug: `e2e-cal-review-l2-${uniqueId}`,
        title: `E2E CAL Review L2 ${uniqueId}`,
      }),
      lessonFixture({
        chapterId: secondChapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "review",
        organizationId: org.id,
        position: 1,
        slug: `e2e-cal-review-r2-${uniqueId}`,
        title: `E2E CAL Review R2 ${uniqueId}`,
      }),
    ]);

  return {
    course,
    firstChapter,
    firstLesson,
    firstMiddleLesson,
    firstReviewLesson,
    secondChapter,
    secondLesson,
    secondReviewLesson,
  };
}

/**
 * Lesson-type preferences are user-specific, so this helper creates a fresh
 * browser user and stores the hidden kinds before the page renders. That keeps
 * this regression isolated from the shared authenticated worker users.
 */
async function createPageWithHiddenLessonKinds({
  browser,
  hiddenLessonKinds,
}: {
  browser: Browser;
  hiddenLessonKinds: LessonKind[];
}) {
  const user = await createE2EUser(getBaseURL(), { orgRole: "member" });

  const [context] = await Promise.all([
    browser.newContext({ storageState: user.storageState }),
    prisma.userLearningProfile.create({
      data: { preferences: { hiddenLessonKinds }, userId: user.id },
    }),
  ]);

  const page = await context.newPage();

  return { context, page, user };
}

test.describe("Continue Lesson Link", () => {
  test("course page shows Try free chapter link for unauthenticated user", async ({ page }) => {
    const { course } = await createTestCourseWithLesson();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    const startLink = getStartFreeChapterLink({ page });
    await expect(startLink).toBeVisible();
  });

  test("course page Try free chapter link navigates to a lesson URL", async ({ page }) => {
    const { course, chapter, lesson } = await createTestCourseWithLesson();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    const startLink = getStartFreeChapterLink({ page });
    await expect(startLink).toBeVisible();
    await startLink.click();

    await expect(page).toHaveURL(
      new RegExp(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}$`, "u"),
    );
  });

  test("chapter page shows Start link for unauthenticated user", async ({ page }) => {
    const { chapter, course } = await createTestCourseWithLesson();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}`);

    const startLink = getContinueActionLink({ label: "Start", page });
    await expect(startLink).toBeVisible();
  });

  test("pending AI lesson player links to lesson generation", async ({ page }) => {
    const { chapter, course, lesson } = await createTestCourseWithPendingFirstLesson();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(page.getByText(/create this lesson/iu)).toBeVisible();

    await expect(page.getByRole("link", { name: /create lesson/iu })).toHaveAttribute(
      "href",
      `/generate/l/${lesson.id}`,
    );
  });

  test("course page falls back to first chapter when no playable step data", async ({ page }) => {
    const { chapter, course } = await createTestCourseWithoutPlayableSteps();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    const startLink = getStartFreeChapterLink({ page });
    await expect(startLink).toBeVisible();

    await expect(startLink).toHaveAttribute(
      "href",
      expect.stringContaining(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}`),
    );
  });

  test("chapter page falls back to first lesson when no playable step data", async ({ page }) => {
    const { chapter, course, lesson } = await createTestCourseWithoutPlayableSteps();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}`);

    const startLink = getContinueActionLink({ label: "Start", page });
    await expect(startLink).toBeVisible();

    await expect(startLink).toHaveAttribute(
      "href",
      expect.stringContaining(`/ch/${chapter.slug}/l/${lesson.slug}`),
    );
  });

  test("shows Continue linking to the player when next lesson is ungenerated", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { lesson, chapter, course, org } = await createTestCourseWithLesson();

    const uniqueId = randomUUID().slice(0, 8);

    const pendingLesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      organizationId: org.id,
      position: 1,
      slug: `e2e-cal-pending-l-${uniqueId}`,
      title: `E2E CAL Pending Lesson ${uniqueId}`,
    });

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: lesson.id,
      userId: withProgressUser.id,
    });

    await authenticatedPage.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    const continueLink = getContinueActionLink({ label: "Continue", page: authenticatedPage });
    await expect(continueLink).toBeVisible();

    await expect(continueLink).toHaveAttribute(
      "href",
      `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${pendingLesson.slug}`,
    );
  });

  test("authenticated user with progress sees Continue on course page", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { lesson, course, org } = await createTestCourseWithLesson();

    await lessonFixture({
      chapterId: lesson.chapterId,
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
      organizationId: org.id,
      position: 1,
      title: `E2E CAL Lesson 2 ${course.slug}`,
    });

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: lesson.id,
      userId: withProgressUser.id,
    });

    await authenticatedPage.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    const continueLink = getContinueActionLink({ label: "Continue", page: authenticatedPage });
    await expect(continueLink).toBeVisible();
  });

  test("course page shows Continue linking to next lesson player when completed", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { lesson, chapter, course, org } = await createTestCourseWithLesson();

    const uniqueId = randomUUID().slice(0, 8);

    const nextLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: org.id,
      position: 1,
      slug: `e2e-cal-next-l-${uniqueId}`,
      title: `E2E CAL Next Lesson ${uniqueId}`,
    });

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: lesson.id,
      userId: withProgressUser.id,
    });

    await authenticatedPage.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    const continueLink = getContinueActionLink({ label: "Continue", page: authenticatedPage });
    await expect(continueLink).toBeVisible();

    await expect(continueLink).toHaveAttribute(
      "href",
      `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${nextLesson.slug}`,
    );
  });

  test("hidden lesson types do not drive continue links or lesson progress", async ({
    browser,
  }) => {
    const org = await getAiOrganization();
    const uniqueId = randomUUID().slice(0, 8);

    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-cal-filter-course-${uniqueId}`,
      title: `E2E CAL Filter Course ${uniqueId}`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
      position: 0,
      slug: `e2e-cal-filter-ch-${uniqueId}`,
      title: `E2E CAL Filter Ch ${uniqueId}`,
    });

    const [completedLesson, hiddenLesson, nextVisibleLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "explanation",
        organizationId: org.id,
        position: 0,
        slug: `e2e-cal-filter-l1-${uniqueId}`,
        title: `E2E CAL Filter L1 ${uniqueId}`,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "quiz",
        organizationId: org.id,
        position: 1,
        slug: `e2e-cal-filter-l2-${uniqueId}`,
        title: `E2E CAL Filter L2 ${uniqueId}`,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "explanation",
        organizationId: org.id,
        position: 2,
        slug: `e2e-cal-filter-l3-${uniqueId}`,
        title: `E2E CAL Filter L3 ${uniqueId}`,
      }),
    ]);

    const { context, page, user } = await createPageWithHiddenLessonKinds({
      browser,
      hiddenLessonKinds: ["quiz"],
    });

    await Promise.all([
      courseUserFixture({ courseId: course.id, userId: user.id }),
      lessonProgressFixture({
        completedAt: new Date("2024-01-01"),
        durationSeconds: 60,
        lessonId: completedLesson.id,
        userId: user.id,
      }),
    ]);

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    const continueLink = getContinueActionLink({ label: "Continue", page });

    await expect(continueLink).toHaveAttribute(
      "href",
      `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${nextVisibleLesson.slug}`,
    );

    await expect(continueLink).not.toHaveAttribute(
      "href",
      `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${hiddenLesson.slug}`,
    );

    const chapterLink = page.getByRole("link", { name: new RegExp(chapter.title, "u") });
    await expect(chapterLink.getByText("1/2 done")).toBeVisible();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}`);

    await page.getByRole("button", { name: "Filter lesson types" }).click();
    await expect(page.getByRole("menuitemcheckbox", { name: "Explanation" })).toBeDisabled();
    await expect(page.getByRole("menuitemcheckbox", { name: "Quiz" })).toBeEnabled();
    await page.keyboard.press("Escape");

    const chapterContinueLink = page
      .getByRole("main")
      .getByRole("link", { name: "Continue 50% complete" });

    const nextVisibleLessonTitle = nextVisibleLesson.title ?? nextVisibleLesson.slug;

    const nextVisibleLessonLink = page.getByRole("link", {
      name: new RegExp(nextVisibleLessonTitle, "u"),
    });

    await expect(chapterContinueLink).toHaveAttribute(
      "href",
      `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${nextVisibleLesson.slug}`,
    );

    await expect(chapterContinueLink).not.toHaveAttribute(
      "href",
      `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${hiddenLesson.slug}`,
    );

    await expect(nextVisibleLessonLink.getByText("2", { exact: true })).toBeVisible();
    await expect(nextVisibleLessonLink.getByText("3", { exact: true })).toHaveCount(0);

    await context.close();
  });

  test("course page shows Continue linking to ungenerated next chapter", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const org = await getAiOrganization();
    const uniqueId = randomUUID().slice(0, 8);

    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-cal-next-empty-course-${uniqueId}`,
      title: `E2E CAL Next Empty Course ${uniqueId}`,
    });

    const [chapter1, chapter2] = await Promise.all([
      chapterFixture({
        courseId: course.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: org.id,
        position: 0,
        slug: `e2e-cal-next-empty-ch1-${uniqueId}`,
        title: `E2E CAL Next Empty Ch1 ${uniqueId}`,
      }),
      chapterFixture({
        courseId: course.id,
        generationStatus: "pending",
        isPublished: true,
        organizationId: org.id,
        position: 1,
        slug: `e2e-cal-next-empty-ch2-${uniqueId}`,
        title: `E2E CAL Next Empty Ch2 ${uniqueId}`,
      }),
    ]);

    const lesson = await lessonFixture({
      chapterId: chapter1.id,
      generationStatus: "completed",
      isPublished: true,
      organizationId: org.id,
      position: 0,
      slug: `e2e-cal-next-empty-l1-${uniqueId}`,
      title: `E2E CAL Next Empty L1 ${uniqueId}`,
    });

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: lesson.id,
      userId: withProgressUser.id,
    });

    await authenticatedPage.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    const continueLink = authenticatedPage.getByRole("link", { name: "Continue" });
    await expect(continueLink).toBeVisible();
    await expect(authenticatedPage.getByRole("link", { name: /\d+% complete/iu })).toHaveCount(0);

    await expect(continueLink).toHaveAttribute(
      "href",
      `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter2.slug}`,
    );
  });

  test("chapter page shows Review linking to the current chapter review when completed", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const {
      course,
      firstChapter,
      firstLesson,
      firstMiddleLesson,
      firstReviewLesson,
      secondChapter,
    } = await createTestCourseWithReviewChapters();

    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date("2024-01-01"),
        durationSeconds: 60,
        lessonId: firstLesson.id,
        userId: withProgressUser.id,
      }),
      lessonProgressFixture({
        completedAt: new Date("2024-01-02"),
        durationSeconds: 60,
        lessonId: firstMiddleLesson.id,
        userId: withProgressUser.id,
      }),
      lessonProgressFixture({
        completedAt: new Date("2024-01-03"),
        durationSeconds: 60,
        lessonId: firstReviewLesson.id,
        userId: withProgressUser.id,
      }),
    ]);

    await authenticatedPage.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${firstChapter.slug}`);

    const reviewLink = getContinueActionLink({ label: "Review", page: authenticatedPage });
    await expect(reviewLink).toBeVisible();

    await expect(reviewLink).toHaveAttribute(
      "href",
      `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${firstChapter.slug}/l/${firstReviewLesson.slug}`,
    );

    await expect(reviewLink).not.toHaveAttribute(
      "href",
      `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${secondChapter.slug}`,
    );
  });

  test("chapter page keeps Continue on the first incomplete lesson after final review", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const {
      course,
      firstChapter,
      firstLesson,
      firstMiddleLesson,
      firstReviewLesson,
      secondChapter,
    } = await createTestCourseWithReviewChapters();

    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date("2024-01-01"),
        durationSeconds: 60,
        lessonId: firstLesson.id,
        userId: withProgressUser.id,
      }),
      lessonProgressFixture({
        completedAt: new Date("2024-01-02"),
        durationSeconds: 60,
        lessonId: firstReviewLesson.id,
        userId: withProgressUser.id,
      }),
    ]);

    await authenticatedPage.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${firstChapter.slug}`);

    const continueLink = getContinueActionLink({ label: "Continue", page: authenticatedPage });
    await expect(continueLink).toBeVisible();

    await expect(continueLink).toHaveAttribute(
      "href",
      `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${firstChapter.slug}/l/${firstMiddleLesson.slug}`,
    );

    await expect(continueLink).not.toHaveAttribute(
      "href",
      `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${secondChapter.slug}`,
    );
  });

  test("course page shows Review when all lessons completed", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const {
      course,
      firstLesson,
      firstMiddleLesson,
      firstReviewLesson,
      secondChapter,
      secondLesson,
      secondReviewLesson,
    } = await createTestCourseWithReviewChapters();

    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date("2024-01-01"),
        durationSeconds: 60,
        lessonId: firstLesson.id,
        userId: withProgressUser.id,
      }),
      lessonProgressFixture({
        completedAt: new Date("2024-01-02"),
        durationSeconds: 60,
        lessonId: firstMiddleLesson.id,
        userId: withProgressUser.id,
      }),
      lessonProgressFixture({
        completedAt: new Date("2024-01-03"),
        durationSeconds: 60,
        lessonId: firstReviewLesson.id,
        userId: withProgressUser.id,
      }),
      lessonProgressFixture({
        completedAt: new Date("2024-01-04"),
        durationSeconds: 60,
        lessonId: secondLesson.id,
        userId: withProgressUser.id,
      }),
      lessonProgressFixture({
        completedAt: new Date("2024-01-05"),
        durationSeconds: 60,
        lessonId: secondReviewLesson.id,
        userId: withProgressUser.id,
      }),
    ]);

    await authenticatedPage.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    const reviewLink = getContinueActionLink({ label: "Review", page: authenticatedPage });
    await expect(reviewLink).toBeVisible();

    await expect(reviewLink).toHaveAttribute(
      "href",
      `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${secondChapter.slug}/l/${secondReviewLesson.slug}`,
    );
  });
});
