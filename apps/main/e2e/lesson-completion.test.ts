import { randomUUID } from "node:crypto";
import { type Browser } from "@playwright/test";
import { request } from "@zoonk/e2e/fixtures";
import { getAiOrganization } from "@zoonk/e2e/helpers";
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

async function createTwoLessonCourse(prefix: string) {
  const org = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-${prefix}-course-${uniqueId}`,
    title: `E2E ${prefix} Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-${prefix}-chapter-${uniqueId}`,
    title: `E2E ${prefix} Chapter ${uniqueId}`,
  });

  const lesson1 = await lessonFixture({
    chapterId: chapter.id,
    description: `First lesson ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    slug: `e2e-${prefix}-lesson1-${uniqueId}`,
    title: `First Lesson ${uniqueId}`,
  });

  const lesson2 = await lessonFixture({
    chapterId: chapter.id,
    description: `Second lesson ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    position: 1,
    slug: `e2e-${prefix}-lesson2-${uniqueId}`,
    title: `Second Lesson ${uniqueId}`,
  });

  const activity = await activityFixture({
    generationStatus: "completed",
    isPublished: true,
    kind: "quiz",
    lessonId: lesson1.id,
    organizationId: org.id,
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

  // Create a placeholder activity for lesson2 so the "Next Lesson" link works.
  await activityFixture({
    generationStatus: "completed",
    isPublished: true,
    kind: "quiz",
    lessonId: lesson2.id,
    organizationId: org.id,
    position: 0,
  });

  return {
    activity,
    activityUrl: `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson1.slug}/a/0`,
    chapter,
    course,
    lesson1,
    lesson2,
    org,
    uniqueId,
  };
}

test.describe("Lesson Completion UX", () => {
  test("shows lesson complete heading and next lesson button on last activity", async ({
    baseURL,
    browser,
  }) => {
    const email = await createUniqueUser(baseURL!);
    const { browserContext, page } = await createAuthenticatedPage(browser, baseURL!, email);
    const { activityUrl, uniqueId } = await createTwoLessonCourse("lcomp");

    await page.goto(activityUrl);
    await page.waitForLoadState("networkidle");

    await page.getByRole("radio", { name: new RegExp(`Right ${uniqueId}`) }).click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    const completionScreen = page.getByRole("status");
    await expect(completionScreen.getByText(/lesson complete/i)).toBeVisible();
    await expect(completionScreen.getByRole("link", { name: /next lesson/i })).toBeVisible();
    await expect(completionScreen.getByRole("link", { name: /review lesson/i })).toBeVisible();

    // Score and gamification elements should not appear on lesson completion
    await expect(completionScreen.getByText(/correct/i)).not.toBeVisible();
    await expect(completionScreen.getByText(/BP/)).not.toBeVisible();

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
      title: `E2E Mute Course ${uniqueId}`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-mute-chapter-${uniqueId}`,
      title: `E2E Mute Chapter ${uniqueId}`,
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

    // Also create an activity for the pending lesson so progress displays
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

    // Completed lesson shows the green check indicator
    const completedItem = authenticatedPage.getByRole("link", {
      name: new RegExp(completedLesson.title),
    });
    await expect(completedItem).toBeVisible();
    await expect(completedItem.getByRole("img", { name: /^completed$/i })).toBeVisible();

    // Pending lesson is visible but does not have a completed indicator
    const pendingItem = authenticatedPage.getByRole("link", {
      name: new RegExp(pendingLesson.title),
    });
    await expect(pendingItem).toBeVisible();
  });

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
      title: `E2E Pending Course ${uniqueId}`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-pend-chapter-${uniqueId}`,
      title: `E2E Pending Chapter ${uniqueId}`,
    });

    const lesson1 = await lessonFixture({
      chapterId: chapter.id,
      description: `Current lesson ${uniqueId}`,
      isPublished: true,
      organizationId: org.id,
      position: 0,
      slug: `e2e-pend-lesson1-${uniqueId}`,
      title: `Current Lesson ${uniqueId}`,
    });

    const lesson2 = await lessonFixture({
      chapterId: chapter.id,
      description: `Pending lesson ${uniqueId}`,
      isPublished: true,
      organizationId: org.id,
      position: 1,
      slug: `e2e-pend-lesson2-${uniqueId}`,
      title: `Pending Lesson ${uniqueId}`,
    });

    const activity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "quiz",
      lessonId: lesson1.id,
      organizationId: org.id,
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

    // Next lesson has only a pending (not generated) activity.
    await activityFixture({
      generationStatus: "pending",
      isPublished: true,
      kind: "quiz",
      lessonId: lesson2.id,
      organizationId: org.id,
      position: 0,
    });

    const activityUrl = `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson1.slug}/a/0`;

    await page.goto(activityUrl);
    await page.waitForLoadState("networkidle");

    await page.getByRole("radio", { name: new RegExp(`Right ${uniqueId}`) }).click();
    await page.getByRole("button", { name: /check/i }).click();
    await page.getByRole("button", { name: /continue/i }).click();

    const completionScreen = page.getByRole("status");
    await expect(completionScreen.getByText(/lesson complete/i)).toBeVisible();
    await expect(completionScreen.getByRole("link", { name: /next lesson/i })).toBeVisible();

    await browserContext.close();
  });

  test("shows all activities completed banner on fully completed lesson", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const org = await getAiOrganization();
    const uniqueId = randomUUID().slice(0, 8);

    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-banner-course-${uniqueId}`,
      title: `E2E Banner Course ${uniqueId}`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-banner-chapter-${uniqueId}`,
      title: `E2E Banner Chapter ${uniqueId}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      description: `Banner lesson ${uniqueId}`,
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-banner-lesson-${uniqueId}`,
      title: `Banner Lesson ${uniqueId}`,
    });

    const activity1 = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "quiz",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 0,
    });

    const activity2 = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "practice",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 1,
    });

    await Promise.all([
      activityProgressFixture({
        activityId: activity1.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
      activityProgressFixture({
        activityId: activity2.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
    ]);

    await authenticatedPage.goto(
      `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`,
    );

    await expect(authenticatedPage.getByText(/all activities completed/i)).toBeVisible();
  });
});
