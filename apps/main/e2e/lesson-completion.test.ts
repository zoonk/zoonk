import { randomUUID } from "node:crypto";
import { type Browser, type Page } from "@playwright/test";
import { request } from "@zoonk/e2e/fixtures";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { activityFixture, activityProgressFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { expect, test } from "./fixtures";

async function createUniqueUser(baseURL: string) {
  const uniqueId = randomUUID().slice(0, 8);
  const email = `e2e-lcomp-${uniqueId}@zoonk.test`;

  const signupContext = await request.newContext({ baseURL });
  const response = await signupContext.post("/api/auth/sign-up/email", {
    data: { email, name: `E2E LComp ${uniqueId}`, password: "password123" },
  });

  expect(response.ok()).toBe(true);
  await signupContext.dispose();

  return email;
}

async function createAuthenticatedPage(browser: Browser, baseURL: string, email: string) {
  const context = await request.newContext({ baseURL });

  await context.post("/api/auth/sign-in/email", {
    data: { email, password: "password123" },
  });

  const storageState = await context.storageState();
  await context.dispose();

  const browserContext = await browser.newContext({ storageState });
  const page = await browserContext.newPage();

  return { browserContext, page };
}

async function createQuizActivity(lessonId: number, orgId: string, uniqueId: string) {
  const activity = await activityFixture({
    generationStatus: "completed",
    isPublished: true,
    kind: "quiz",
    lessonId,
    organizationId: orgId,
    position: 0,
  });

  await stepFixture({
    activityId: activity.id,
    content: {
      kind: "core",
      options: [
        { feedback: "Correct!", isCorrect: true, text: `Right ${uniqueId}` },
        { feedback: "Wrong", isCorrect: false, text: `Wrong ${uniqueId}` },
      ],
      question: `Question ${uniqueId}`,
    },
    isPublished: true,
    kind: "multipleChoice",
  });

  return activity;
}

async function completeQuiz(page: Page, uniqueId: string) {
  await page.getByRole("radio", { name: new RegExp(`Right ${uniqueId}`) }).click();
  await page.getByRole("button", { name: /check/i }).click();
  await page.getByRole("button", { name: /continue/i }).click();
}

/**
 * Two lessons in one chapter. Completing lesson1's activity → "Lesson Complete".
 * "Next Lesson" → lesson2 page. "Review Lesson" → lesson1 page.
 */
async function createLessonCompleteScenario(prefix: string) {
  const org = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-${prefix}-course-${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-${prefix}-ch-${uniqueId}`,
  });

  const lesson1 = await lessonFixture({
    chapterId: chapter.id,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    slug: `e2e-${prefix}-l1-${uniqueId}`,
    title: `First Lesson ${uniqueId}`,
  });

  const lesson2 = await lessonFixture({
    chapterId: chapter.id,
    isPublished: true,
    organizationId: org.id,
    position: 1,
    slug: `e2e-${prefix}-l2-${uniqueId}`,
    title: `Second Lesson ${uniqueId}`,
  });

  await Promise.all([
    createQuizActivity(lesson1.id, org.id, uniqueId),
    // Lesson2 needs an activity so its page renders (no redirect to generate).
    activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
      lessonId: lesson2.id,
      organizationId: org.id,
      position: 0,
    }),
  ]);

  return {
    activityUrl: `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson1.slug}/a/0`,
    lesson1,
    lesson2,
    uniqueId,
  };
}

/**
 * One lesson per chapter, two chapters. Completing chapter1's lesson → "Chapter Complete".
 * "Next Chapter" → chapter2 page. "Review Chapter" → chapter1 page.
 */
async function createChapterCompleteScenario(prefix: string) {
  const org = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-${prefix}-course-${uniqueId}`,
  });

  const chapter1 = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    slug: `e2e-${prefix}-ch1-${uniqueId}`,
    title: `First Chapter ${uniqueId}`,
  });

  const chapter2 = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    position: 1,
    slug: `e2e-${prefix}-ch2-${uniqueId}`,
    title: `Second Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter1.id,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    slug: `e2e-${prefix}-lesson-${uniqueId}`,
  });

  // Chapter2 needs a lesson so getNextSibling finds it.
  await lessonFixture({
    chapterId: chapter2.id,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    slug: `e2e-${prefix}-next-${uniqueId}`,
  });

  await createQuizActivity(lesson.id, org.id, uniqueId);

  return {
    activityUrl: `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter1.slug}/l/${lesson.slug}/a/0`,
    chapter1,
    chapter2,
    uniqueId,
  };
}

/**
 * One chapter, one lesson, one activity. Completing it → "Course Complete".
 * "Review Course" → course page. "Review Chapter" → chapter page.
 */
async function createCourseCompleteScenario(prefix: string) {
  const org = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-${prefix}-course-${uniqueId}`,
    title: `Complete Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    slug: `e2e-${prefix}-ch-${uniqueId}`,
    title: `Final Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    slug: `e2e-${prefix}-lesson-${uniqueId}`,
  });

  await createQuizActivity(lesson.id, org.id, uniqueId);

  return {
    activityUrl: `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`,
    chapter,
    course,
    uniqueId,
  };
}

test.describe("Lesson Completion UX", () => {
  // --- Lesson Complete ---

  test("lesson complete: next lesson navigates to next lesson page", async ({
    baseURL,
    browser,
  }) => {
    const email = await createUniqueUser(baseURL!);
    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);
    const { activityUrl, lesson2, uniqueId } = await createLessonCompleteScenario("lnext");

    await page.goto(activityUrl);
    await page.waitForLoadState("networkidle");
    await completeQuiz(page, uniqueId);

    const completionScreen = page.getByRole("status");
    await expect(completionScreen.getByText(/lesson complete/i)).toBeVisible();

    // No score or gamification on milestone screen
    await expect(completionScreen.getByText(/correct/i)).not.toBeVisible();

    await completionScreen.getByRole("link", { name: /next lesson/i }).click();
    await expect(page.getByRole("heading", { level: 1, name: lesson2.title })).toBeVisible();

    await browserContext.close();
  });

  test("lesson complete: review lesson navigates to current lesson page", async ({
    baseURL,
    browser,
  }) => {
    const email = await createUniqueUser(baseURL!);
    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);
    const { activityUrl, lesson1, uniqueId } = await createLessonCompleteScenario("lrev");

    await page.goto(activityUrl);
    await page.waitForLoadState("networkidle");
    await completeQuiz(page, uniqueId);

    const completionScreen = page.getByRole("status");

    await completionScreen.getByRole("link", { name: /review lesson/i }).click();
    await expect(page.getByRole("heading", { level: 1, name: lesson1.title })).toBeVisible();

    await browserContext.close();
  });

  // --- Chapter Complete ---

  test("chapter complete: next chapter navigates to next chapter page", async ({
    baseURL,
    browser,
  }) => {
    const email = await createUniqueUser(baseURL!);
    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);
    const { activityUrl, chapter2, uniqueId } = await createChapterCompleteScenario("chnext");

    await page.goto(activityUrl);
    await page.waitForLoadState("networkidle");
    await completeQuiz(page, uniqueId);

    const completionScreen = page.getByRole("status");
    await expect(completionScreen.getByText(/chapter complete/i)).toBeVisible();

    await completionScreen.getByRole("link", { name: /next chapter/i }).click();
    await expect(page.getByRole("heading", { level: 1, name: chapter2.title })).toBeVisible();

    await browserContext.close();
  });

  test("chapter complete: review chapter navigates to current chapter page", async ({
    baseURL,
    browser,
  }) => {
    const email = await createUniqueUser(baseURL!);
    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);
    const { activityUrl, chapter1, uniqueId } = await createChapterCompleteScenario("chrev");

    await page.goto(activityUrl);
    await page.waitForLoadState("networkidle");
    await completeQuiz(page, uniqueId);

    const completionScreen = page.getByRole("status");

    await completionScreen.getByRole("link", { name: /review chapter/i }).click();
    await expect(page.getByRole("heading", { level: 1, name: chapter1.title })).toBeVisible();

    await browserContext.close();
  });

  // --- Course Complete ---

  test("course complete: review course navigates to course page", async ({ baseURL, browser }) => {
    const email = await createUniqueUser(baseURL!);
    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);
    const { activityUrl, course, uniqueId } = await createCourseCompleteScenario("crsrev");

    await page.goto(activityUrl);
    await page.waitForLoadState("networkidle");
    await completeQuiz(page, uniqueId);

    const completionScreen = page.getByRole("status");
    await expect(completionScreen.getByText(/course complete/i)).toBeVisible();

    await completionScreen.getByRole("link", { name: /review course/i }).click();
    await expect(page.getByRole("heading", { level: 1, name: course.title })).toBeVisible();

    await browserContext.close();
  });

  test("course complete: review chapter navigates to current chapter page", async ({
    baseURL,
    browser,
  }) => {
    const email = await createUniqueUser(baseURL!);
    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);
    const { activityUrl, chapter, uniqueId } = await createCourseCompleteScenario("crschrev");

    await page.goto(activityUrl);
    await page.waitForLoadState("networkidle");
    await completeQuiz(page, uniqueId);

    const completionScreen = page.getByRole("status");

    await completionScreen.getByRole("link", { name: /review chapter/i }).click();
    await expect(page.getByRole("heading", { level: 1, name: chapter.title })).toBeVisible();

    await browserContext.close();
  });

  // --- Other ---

  test("shows next lesson button even when next lesson has pending generation", async ({
    baseURL,
    browser,
  }) => {
    const email = await createUniqueUser(baseURL!);
    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);

    const org = await getAiOrganization();
    const uniqueId = randomUUID().slice(0, 8);

    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-pend-course-${uniqueId}`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-pend-chapter-${uniqueId}`,
    });

    const lesson1 = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: org.id,
      position: 0,
      slug: `e2e-pend-lesson1-${uniqueId}`,
    });

    await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: org.id,
      position: 1,
      slug: `e2e-pend-lesson2-${uniqueId}`,
    });

    await createQuizActivity(lesson1.id, org.id, uniqueId);

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson1.slug}/a/0`);
    await page.waitForLoadState("networkidle");
    await completeQuiz(page, uniqueId);

    const completionScreen = page.getByRole("status");
    await expect(completionScreen.getByText(/lesson complete/i)).toBeVisible();
    await expect(completionScreen.getByRole("link", { name: /next lesson/i })).toBeVisible();

    await browserContext.close();
  });

  test("completed lesson shows check indicator in chapter lesson list", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const org = await getAiOrganization();
    const uniqueId = randomUUID().slice(0, 8);

    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-mute-course-${uniqueId}`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-mute-chapter-${uniqueId}`,
    });

    const completedLesson = await lessonFixture({
      chapterId: chapter.id,
      description: `Completed lesson ${uniqueId}`,
      isPublished: true,
      organizationId: org.id,
      position: 0,
      slug: `e2e-mute-done-${uniqueId}`,
      title: `Done Lesson ${uniqueId}`,
    });

    const pendingLesson = await lessonFixture({
      chapterId: chapter.id,
      description: `Pending lesson ${uniqueId}`,
      isPublished: true,
      organizationId: org.id,
      position: 1,
      slug: `e2e-mute-pending-${uniqueId}`,
      title: `Pending Lesson ${uniqueId}`,
    });

    const activity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "quiz",
      lessonId: completedLesson.id,
      organizationId: org.id,
      position: 0,
    });

    await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "quiz",
      lessonId: pendingLesson.id,
      organizationId: org.id,
      position: 0,
    });

    await activityProgressFixture({
      activityId: activity.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: withProgressUser.id,
    });

    await authenticatedPage.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}`);
    await authenticatedPage.waitForLoadState("networkidle");

    const completedItem = authenticatedPage.getByRole("link", {
      name: new RegExp(completedLesson.title),
    });
    await expect(completedItem).toBeVisible();
    await expect(completedItem.getByRole("img", { name: /^completed$/i })).toBeVisible();

    const pendingItem = authenticatedPage.getByRole("link", {
      name: new RegExp(pendingLesson.title),
    });
    await expect(pendingItem).toBeVisible();
  });
});
