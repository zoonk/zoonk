import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { type Page, type Route } from "@zoonk/e2e/fixtures";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { normalizeString } from "@zoonk/utils/string";
import { expect, test } from "./fixtures";

/**
 * Test Architecture for Activity Generation Page
 *
 * The generation page has 3 access states:
 * 1. Unauthenticated - Shows login prompt
 * 2. Authenticated without subscription - Shows upgrade CTA
 * 3. Authenticated with subscription - Shows generation UI
 *
 * The generation flow interacts with 2 APIs on the API server:
 * 1. POST ${API_BASE_URL}/v1/workflows/activity-generation/trigger - Starts the workflow, returns { runId: string }
 * 2. GET ${API_BASE_URL}/v1/workflows/activity-generation/status?runId=X&startIndex=N - Returns SSE stream of step updates
 */

const TEST_RUN_ID = "test-run-id-activity-12345";
const TEST_USER_EMAIL = "e2e-new@zoonk.test";

type MockApiOptions = {
  triggerResponse?: { runId?: string; error?: string; status?: number };
  streamDelayMs?: number;
  streamMessages?: { step: string; status: string }[];
  streamError?: boolean;
};

/**
 * Creates a mock SSE stream response from an array of messages.
 */
function createSSEStream(messages: { step: string; status: string }[]): string {
  return messages.map((msg) => `data: ${JSON.stringify(msg)}\n\n`).join("");
}

/**
 * Creates the route handler function for mocking APIs.
 */
function createRouteHandler(options: MockApiOptions) {
  const {
    triggerResponse = { runId: TEST_RUN_ID },
    streamDelayMs = 0,
    streamMessages = [],
    streamError = false,
  } = options;

  return async (route: Route) => {
    const url = route.request().url();
    const method = route.request().method();

    // Mock trigger API
    if (url.includes("/v1/workflows/activity-generation/trigger") && method === "POST") {
      if (triggerResponse.error) {
        await route.fulfill({
          body: JSON.stringify({ error: triggerResponse.error }),
          contentType: "application/json",
          status: triggerResponse.status ?? 500,
        });
        return;
      }
      await route.fulfill({
        body: JSON.stringify({
          message: "Workflow started",
          runId: triggerResponse.runId,
        }),
        contentType: "application/json",
        status: 200,
      });
      return;
    }

    // Mock status stream API
    if (url.includes("/v1/workflows/activity-generation/status")) {
      if (streamError) {
        await route.abort("failed");
        return;
      }

      if (streamDelayMs > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, streamDelayMs);
        });
      }

      await route.fulfill({
        body: createSSEStream(streamMessages),
        contentType: "text/event-stream",
        status: 200,
      });
      return;
    }

    // Continue with all other requests
    await route.continue();
  };
}

/**
 * Sets up route interception for activity generation APIs.
 */
async function setupMockApis(page: Page, options: MockApiOptions = {}): Promise<void> {
  const handler = createRouteHandler(options);
  await page.route("**/v1/workflows/activity-generation/**", handler);
}

/**
 * Creates an activity with pending generation status for testing the generation workflow.
 */
async function createPendingActivity() {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

  const uniqueId = randomUUID().slice(0, 8);
  const courseTitle = `E2E Activity Course ${uniqueId}`;
  const chapterTitle = `E2E Activity Chapter ${uniqueId}`;
  const lessonTitle = `E2E Activity Lesson ${uniqueId}`;
  const activityTitle = `E2E Generation Activity ${uniqueId}`;

  const course = await courseFixture({
    isPublished: true,
    normalizedTitle: normalizeString(courseTitle),
    organizationId: org.id,
    slug: `e2e-activity-course-${uniqueId}`,
    title: courseTitle,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    generationStatus: "completed",
    isPublished: true,
    normalizedTitle: normalizeString(chapterTitle),
    organizationId: org.id,
    slug: `e2e-activity-chapter-${uniqueId}`,
    title: chapterTitle,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    generationStatus: "completed",
    isPublished: true,
    normalizedTitle: normalizeString(lessonTitle),
    organizationId: org.id,
    slug: `e2e-activity-lesson-${uniqueId}`,
    title: lessonTitle,
  });

  const activity = await activityFixture({
    generationStatus: "pending",
    isPublished: true,
    kind: "background",
    lessonId: lesson.id,
    organizationId: org.id,
    title: activityTitle,
  });

  return { activity, chapter, course, lesson, organizationId: org.id };
}

async function createPendingReadingActivity() {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

  const uniqueId = randomUUID().slice(0, 8);
  const courseTitle = `E2E Reading Course ${uniqueId}`;
  const chapterTitle = `E2E Reading Chapter ${uniqueId}`;
  const lessonTitle = `E2E Reading Lesson ${uniqueId}`;
  const activityTitle = `E2E Reading Activity ${uniqueId}`;

  const course = await courseFixture({
    isPublished: true,
    normalizedTitle: normalizeString(courseTitle),
    organizationId: org.id,
    slug: `e2e-reading-course-${uniqueId}`,
    targetLanguage: "es",
    title: courseTitle,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    generationStatus: "completed",
    isPublished: true,
    normalizedTitle: normalizeString(chapterTitle),
    organizationId: org.id,
    slug: `e2e-reading-chapter-${uniqueId}`,
    title: chapterTitle,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    generationStatus: "completed",
    isPublished: true,
    kind: "language",
    normalizedTitle: normalizeString(lessonTitle),
    organizationId: org.id,
    slug: `e2e-reading-lesson-${uniqueId}`,
    title: lessonTitle,
  });

  const activity = await activityFixture({
    generationStatus: "pending",
    isPublished: true,
    kind: "reading",
    lessonId: lesson.id,
    organizationId: org.id,
    title: activityTitle,
  });

  return { activity, chapter, course, lesson };
}

/**
 * Creates a test subscription for the test user.
 */
async function createTestSubscription() {
  const uniqueId = randomUUID();

  const user = await prisma.user.findUniqueOrThrow({
    where: { email: TEST_USER_EMAIL },
  });

  const subscription = await prisma.subscription.create({
    data: {
      plan: "hobby",
      referenceId: String(user.id),
      status: "active",
      stripeCustomerId: `cus_test_e2e_activity_${uniqueId}`,
      stripeSubscriptionId: `sub_test_e2e_activity_${uniqueId}`,
    },
  });

  return subscription;
}

test.describe("Generate Activity Page - Unauthenticated", () => {
  test("shows login prompt with link to login page", async ({ page }) => {
    const { activity } = await createPendingActivity();
    await page.goto(`/generate/a/${activity.id}`);

    await expect(page.getByRole("alert").filter({ hasText: /logged in/i })).toBeVisible();

    const loginLink = page.getByRole("link", { name: /login/i });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute("href", "/login");
  });
});

test.describe("Generate Activity Page - No Subscription", () => {
  test("shows upgrade CTA when authenticated without subscription", async ({
    authenticatedPage,
  }) => {
    const { activity } = await createPendingActivity();
    await authenticatedPage.goto(`/generate/a/${activity.id}`);

    await expect(authenticatedPage.getByText(/upgrade to generate/i)).toBeVisible();

    await expect(authenticatedPage.getByRole("button", { name: /upgrade/i })).toBeVisible();
  });
});

test.describe("Generate Activity Page - With Subscription", () => {
  test("shows generation UI and completes workflow", async ({ userWithoutProgress }) => {
    await createTestSubscription();
    const { activity, chapter, course, lesson } = await createPendingActivity();

    await setupMockApis(userWithoutProgress, {
      streamMessages: [
        { status: "started", step: "getLessonActivities" },
        { status: "completed", step: "getLessonActivities" },
        { status: "started", step: "setActivityAsRunning" },
        { status: "completed", step: "setActivityAsRunning" },
        { status: "started", step: "generateBackgroundContent" },
        { status: "completed", step: "generateBackgroundContent" },
        { status: "started", step: "generateVisuals" },
        { status: "completed", step: "generateVisuals" },
        { status: "started", step: "generateImages" },
        { status: "completed", step: "generateImages" },
        { status: "started", step: "setBackgroundAsCompleted" },
        { status: "completed", step: "setBackgroundAsCompleted" },
      ],
    });

    await userWithoutProgress.goto(`/generate/a/${activity.id}`);

    // Should show completion message
    await expect(userWithoutProgress.getByText(/your activity is ready/i)).toBeVisible({
      timeout: 10_000,
    });

    await expect(userWithoutProgress.getByText(/taking you to your activity/i)).toBeVisible();

    // Update activity status so redirect works
    await prisma.activity.update({
      data: { generationStatus: "completed" },
      where: { id: activity.id },
    });

    // Should redirect to activity page
    await userWithoutProgress.waitForURL(
      new RegExp(
        `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/${activity.position}`,
      ),
      { timeout: 10_000 },
    );
  });

  test("completes workflow for examples activity kind", async ({ userWithoutProgress }) => {
    await createTestSubscription();

    const org = await prisma.organization.findUniqueOrThrow({
      where: { slug: "ai" },
    });

    const uniqueId = randomUUID().slice(0, 8);
    const courseTitle = `E2E Examples Course ${uniqueId}`;
    const chapterTitle = `E2E Examples Chapter ${uniqueId}`;
    const lessonTitle = `E2E Examples Lesson ${uniqueId}`;
    const activityTitle = `E2E Examples Activity ${uniqueId}`;

    const course = await courseFixture({
      isPublished: true,
      normalizedTitle: normalizeString(courseTitle),
      organizationId: org.id,
      slug: `e2e-examples-course-${uniqueId}`,
      title: courseTitle,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      generationStatus: "completed",
      isPublished: true,
      normalizedTitle: normalizeString(chapterTitle),
      organizationId: org.id,
      slug: `e2e-examples-chapter-${uniqueId}`,
      title: chapterTitle,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      normalizedTitle: normalizeString(lessonTitle),
      organizationId: org.id,
      slug: `e2e-examples-lesson-${uniqueId}`,
      title: lessonTitle,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      isPublished: true,
      kind: "examples",
      lessonId: lesson.id,
      organizationId: org.id,
      title: activityTitle,
    });

    await setupMockApis(userWithoutProgress, {
      streamMessages: [
        { status: "started", step: "getLessonActivities" },
        { status: "completed", step: "getLessonActivities" },
        { status: "started", step: "setActivityAsRunning" },
        { status: "completed", step: "setActivityAsRunning" },
        { status: "started", step: "generateBackgroundContent" },
        { status: "completed", step: "generateBackgroundContent" },
        { status: "started", step: "generateExplanationContent" },
        { status: "completed", step: "generateExplanationContent" },
        { status: "started", step: "generateExamplesContent" },
        { status: "completed", step: "generateExamplesContent" },
        { status: "started", step: "generateVisuals" },
        { status: "completed", step: "generateVisuals" },
        { status: "started", step: "generateImages" },
        { status: "completed", step: "generateImages" },
        { status: "started", step: "setExamplesAsCompleted" },
        { status: "completed", step: "setExamplesAsCompleted" },
      ],
    });

    await userWithoutProgress.goto(`/generate/a/${activity.id}`);

    await expect(userWithoutProgress.getByText(/your activity is ready/i)).toBeVisible({
      timeout: 10_000,
    });

    await expect(userWithoutProgress.getByText(/taking you to your activity/i)).toBeVisible();

    await prisma.activity.update({
      data: { generationStatus: "completed" },
      where: { id: activity.id },
    });

    await userWithoutProgress.waitForURL(
      new RegExp(
        `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/${activity.position}`,
      ),
      { timeout: 10_000 },
    );
  });

  test("completes workflow for story activity kind", async ({ userWithoutProgress }) => {
    await createTestSubscription();

    const org = await prisma.organization.findUniqueOrThrow({
      where: { slug: "ai" },
    });

    const uniqueId = randomUUID().slice(0, 8);
    const courseTitle = `E2E Story Course ${uniqueId}`;
    const chapterTitle = `E2E Story Chapter ${uniqueId}`;
    const lessonTitle = `E2E Story Lesson ${uniqueId}`;
    const activityTitle = `E2E Story Activity ${uniqueId}`;

    const course = await courseFixture({
      isPublished: true,
      normalizedTitle: normalizeString(courseTitle),
      organizationId: org.id,
      slug: `e2e-story-course-${uniqueId}`,
      title: courseTitle,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      generationStatus: "completed",
      isPublished: true,
      normalizedTitle: normalizeString(chapterTitle),
      organizationId: org.id,
      slug: `e2e-story-chapter-${uniqueId}`,
      title: chapterTitle,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      normalizedTitle: normalizeString(lessonTitle),
      organizationId: org.id,
      slug: `e2e-story-lesson-${uniqueId}`,
      title: lessonTitle,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      isPublished: true,
      kind: "story",
      lessonId: lesson.id,
      organizationId: org.id,
      title: activityTitle,
    });

    await setupMockApis(userWithoutProgress, {
      streamMessages: [
        { status: "started", step: "getLessonActivities" },
        { status: "completed", step: "getLessonActivities" },
        { status: "started", step: "setActivityAsRunning" },
        { status: "completed", step: "setActivityAsRunning" },
        { status: "started", step: "generateBackgroundContent" },
        { status: "completed", step: "generateBackgroundContent" },
        { status: "started", step: "generateExplanationContent" },
        { status: "completed", step: "generateExplanationContent" },
        { status: "started", step: "generateStoryContent" },
        { status: "completed", step: "generateStoryContent" },
        { status: "started", step: "setStoryAsCompleted" },
        { status: "completed", step: "setStoryAsCompleted" },
      ],
    });

    await userWithoutProgress.goto(`/generate/a/${activity.id}`);

    await expect(userWithoutProgress.getByText(/your activity is ready/i)).toBeVisible({
      timeout: 10_000,
    });

    await expect(userWithoutProgress.getByText(/taking you to your activity/i)).toBeVisible();

    await prisma.activity.update({
      data: { generationStatus: "completed" },
      where: { id: activity.id },
    });

    await userWithoutProgress.waitForURL(
      new RegExp(
        `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/${activity.position}`,
      ),
      { timeout: 10_000 },
    );
  });

  test("completes workflow for challenge activity kind", async ({ userWithoutProgress }) => {
    await createTestSubscription();

    const org = await prisma.organization.findUniqueOrThrow({
      where: { slug: "ai" },
    });

    const uniqueId = randomUUID().slice(0, 8);
    const courseTitle = `E2E Challenge Course ${uniqueId}`;
    const chapterTitle = `E2E Challenge Chapter ${uniqueId}`;
    const lessonTitle = `E2E Challenge Lesson ${uniqueId}`;
    const activityTitle = `E2E Challenge Activity ${uniqueId}`;

    const course = await courseFixture({
      isPublished: true,
      normalizedTitle: normalizeString(courseTitle),
      organizationId: org.id,
      slug: `e2e-challenge-course-${uniqueId}`,
      title: courseTitle,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      generationStatus: "completed",
      isPublished: true,
      normalizedTitle: normalizeString(chapterTitle),
      organizationId: org.id,
      slug: `e2e-challenge-chapter-${uniqueId}`,
      title: chapterTitle,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      normalizedTitle: normalizeString(lessonTitle),
      organizationId: org.id,
      slug: `e2e-challenge-lesson-${uniqueId}`,
      title: lessonTitle,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      isPublished: true,
      kind: "challenge",
      lessonId: lesson.id,
      organizationId: org.id,
      title: activityTitle,
    });

    await setupMockApis(userWithoutProgress, {
      streamMessages: [
        { status: "started", step: "getLessonActivities" },
        { status: "completed", step: "getLessonActivities" },
        { status: "started", step: "setActivityAsRunning" },
        { status: "completed", step: "setActivityAsRunning" },
        { status: "started", step: "generateBackgroundContent" },
        { status: "completed", step: "generateBackgroundContent" },
        { status: "started", step: "generateExplanationContent" },
        { status: "completed", step: "generateExplanationContent" },
        { status: "started", step: "generateChallengeContent" },
        { status: "completed", step: "generateChallengeContent" },
        { status: "started", step: "setChallengeAsCompleted" },
        { status: "completed", step: "setChallengeAsCompleted" },
      ],
    });

    await userWithoutProgress.goto(`/generate/a/${activity.id}`);

    await expect(userWithoutProgress.getByText(/your activity is ready/i)).toBeVisible({
      timeout: 10_000,
    });

    await expect(userWithoutProgress.getByText(/taking you to your activity/i)).toBeVisible();

    await prisma.activity.update({
      data: { generationStatus: "completed" },
      where: { id: activity.id },
    });

    await userWithoutProgress.waitForURL(
      new RegExp(
        `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/${activity.position}`,
      ),
      { timeout: 10_000 },
    );
  });

  test("completes workflow for review activity kind", async ({ userWithoutProgress }) => {
    await createTestSubscription();

    const org = await prisma.organization.findUniqueOrThrow({
      where: { slug: "ai" },
    });

    const uniqueId = randomUUID().slice(0, 8);
    const courseTitle = `E2E Review Course ${uniqueId}`;
    const chapterTitle = `E2E Review Chapter ${uniqueId}`;
    const lessonTitle = `E2E Review Lesson ${uniqueId}`;
    const activityTitle = `E2E Review Activity ${uniqueId}`;

    const course = await courseFixture({
      isPublished: true,
      normalizedTitle: normalizeString(courseTitle),
      organizationId: org.id,
      slug: `e2e-review-course-${uniqueId}`,
      title: courseTitle,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      generationStatus: "completed",
      isPublished: true,
      normalizedTitle: normalizeString(chapterTitle),
      organizationId: org.id,
      slug: `e2e-review-chapter-${uniqueId}`,
      title: chapterTitle,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      normalizedTitle: normalizeString(lessonTitle),
      organizationId: org.id,
      slug: `e2e-review-lesson-${uniqueId}`,
      title: lessonTitle,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      isPublished: true,
      kind: "review",
      lessonId: lesson.id,
      organizationId: org.id,
      title: activityTitle,
    });

    await setupMockApis(userWithoutProgress, {
      streamMessages: [
        { status: "started", step: "getLessonActivities" },
        { status: "completed", step: "getLessonActivities" },
        { status: "started", step: "setActivityAsRunning" },
        { status: "completed", step: "setActivityAsRunning" },
        { status: "started", step: "generateBackgroundContent" },
        { status: "completed", step: "generateBackgroundContent" },
        { status: "started", step: "generateExplanationContent" },
        { status: "completed", step: "generateExplanationContent" },
        { status: "started", step: "generateReviewContent" },
        { status: "completed", step: "generateReviewContent" },
        { status: "started", step: "setReviewAsCompleted" },
        { status: "completed", step: "setReviewAsCompleted" },
      ],
    });

    await userWithoutProgress.goto(`/generate/a/${activity.id}`);

    await expect(userWithoutProgress.getByText(/your activity is ready/i)).toBeVisible({
      timeout: 10_000,
    });

    await expect(userWithoutProgress.getByText(/taking you to your activity/i)).toBeVisible();

    await prisma.activity.update({
      data: { generationStatus: "completed" },
      where: { id: activity.id },
    });

    await userWithoutProgress.waitForURL(
      new RegExp(
        `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/${activity.position}`,
      ),
      { timeout: 10_000 },
    );
  });

  test("completes workflow for custom activity kind", async ({ userWithoutProgress }) => {
    await createTestSubscription();

    const org = await prisma.organization.findUniqueOrThrow({
      where: { slug: "ai" },
    });

    const uniqueId = randomUUID().slice(0, 8);
    const courseTitle = `E2E Custom Course ${uniqueId}`;
    const chapterTitle = `E2E Custom Chapter ${uniqueId}`;
    const lessonTitle = `E2E Custom Lesson ${uniqueId}`;
    const activityTitle = `E2E Custom Activity ${uniqueId}`;

    const course = await courseFixture({
      isPublished: true,
      normalizedTitle: normalizeString(courseTitle),
      organizationId: org.id,
      slug: `e2e-custom-course-${uniqueId}`,
      title: courseTitle,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      generationStatus: "completed",
      isPublished: true,
      normalizedTitle: normalizeString(chapterTitle),
      organizationId: org.id,
      slug: `e2e-custom-chapter-${uniqueId}`,
      title: chapterTitle,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      normalizedTitle: normalizeString(lessonTitle),
      organizationId: org.id,
      slug: `e2e-custom-lesson-${uniqueId}`,
      title: lessonTitle,
    });

    const activity = await activityFixture({
      description: "Practice custom content generation",
      generationStatus: "pending",
      isPublished: true,
      kind: "custom",
      lessonId: lesson.id,
      organizationId: org.id,
      title: activityTitle,
    });

    await setupMockApis(userWithoutProgress, {
      streamMessages: [
        { status: "started", step: "getLessonActivities" },
        { status: "completed", step: "getLessonActivities" },
        { status: "started", step: "setActivityAsRunning" },
        { status: "completed", step: "setActivityAsRunning" },
        { status: "started", step: "generateCustomContent" },
        { status: "completed", step: "generateCustomContent" },
        { status: "started", step: "generateVisuals" },
        { status: "completed", step: "generateVisuals" },
        { status: "started", step: "generateImages" },
        { status: "completed", step: "generateImages" },
        { status: "started", step: "setCustomAsCompleted" },
        { status: "completed", step: "setCustomAsCompleted" },
      ],
    });

    await userWithoutProgress.goto(`/generate/a/${activity.id}`);

    await expect(userWithoutProgress.getByText(/your activity is ready/i)).toBeVisible({
      timeout: 10_000,
    });

    await expect(userWithoutProgress.getByText(/taking you to your activity/i)).toBeVisible();

    await prisma.activity.update({
      data: { generationStatus: "completed" },
      where: { id: activity.id },
    });

    await userWithoutProgress.waitForURL(
      new RegExp(
        `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/${activity.position}`,
      ),
      { timeout: 10_000 },
    );
  });

  test("completes workflow for vocabulary activity kind", async ({ userWithoutProgress }) => {
    await createTestSubscription();

    const org = await prisma.organization.findUniqueOrThrow({
      where: { slug: "ai" },
    });

    const uniqueId = randomUUID().slice(0, 8);
    const courseTitle = `E2E Vocabulary Course ${uniqueId}`;
    const chapterTitle = `E2E Vocabulary Chapter ${uniqueId}`;
    const lessonTitle = `E2E Vocabulary Lesson ${uniqueId}`;
    const activityTitle = `E2E Vocabulary Activity ${uniqueId}`;

    const course = await courseFixture({
      isPublished: true,
      normalizedTitle: normalizeString(courseTitle),
      organizationId: org.id,
      slug: `e2e-vocabulary-course-${uniqueId}`,
      targetLanguage: "es",
      title: courseTitle,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      generationStatus: "completed",
      isPublished: true,
      normalizedTitle: normalizeString(chapterTitle),
      organizationId: org.id,
      slug: `e2e-vocabulary-chapter-${uniqueId}`,
      title: chapterTitle,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      kind: "language",
      normalizedTitle: normalizeString(lessonTitle),
      organizationId: org.id,
      slug: `e2e-vocabulary-lesson-${uniqueId}`,
      title: lessonTitle,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      isPublished: true,
      kind: "vocabulary",
      lessonId: lesson.id,
      organizationId: org.id,
      title: activityTitle,
    });

    await setupMockApis(userWithoutProgress, {
      streamMessages: [
        { status: "started", step: "getLessonActivities" },
        { status: "completed", step: "getLessonActivities" },
        { status: "started", step: "setActivityAsRunning" },
        { status: "completed", step: "setActivityAsRunning" },
        { status: "started", step: "generateVocabularyContent" },
        { status: "completed", step: "generateVocabularyContent" },
        { status: "started", step: "saveVocabularyWords" },
        { status: "completed", step: "saveVocabularyWords" },
        { status: "started", step: "generateVocabularyPronunciation" },
        { status: "completed", step: "generateVocabularyPronunciation" },
        { status: "started", step: "generateVocabularyAudio" },
        { status: "completed", step: "generateVocabularyAudio" },
        { status: "started", step: "updateVocabularyEnrichments" },
        { status: "completed", step: "updateVocabularyEnrichments" },
        { status: "started", step: "setVocabularyAsCompleted" },
        { status: "completed", step: "setVocabularyAsCompleted" },
      ],
    });

    await userWithoutProgress.goto(`/generate/a/${activity.id}`);

    await expect(userWithoutProgress.getByText(/your activity is ready/i)).toBeVisible({
      timeout: 10_000,
    });

    await expect(userWithoutProgress.getByText(/taking you to your activity/i)).toBeVisible();

    await prisma.activity.update({
      data: { generationStatus: "completed" },
      where: { id: activity.id },
    });

    await userWithoutProgress.waitForURL(
      new RegExp(
        `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/${activity.position}`,
      ),
      { timeout: 10_000 },
    );
  });

  test("completes workflow for grammar activity kind", async ({ userWithoutProgress }) => {
    await createTestSubscription();

    const org = await prisma.organization.findUniqueOrThrow({
      where: { slug: "ai" },
    });

    const uniqueId = randomUUID().slice(0, 8);
    const courseTitle = `E2E Grammar Course ${uniqueId}`;
    const chapterTitle = `E2E Grammar Chapter ${uniqueId}`;
    const lessonTitle = `E2E Grammar Lesson ${uniqueId}`;
    const activityTitle = `E2E Grammar Activity ${uniqueId}`;

    const course = await courseFixture({
      isPublished: true,
      normalizedTitle: normalizeString(courseTitle),
      organizationId: org.id,
      slug: `e2e-grammar-course-${uniqueId}`,
      targetLanguage: "es",
      title: courseTitle,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      generationStatus: "completed",
      isPublished: true,
      normalizedTitle: normalizeString(chapterTitle),
      organizationId: org.id,
      slug: `e2e-grammar-chapter-${uniqueId}`,
      title: chapterTitle,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      kind: "language",
      normalizedTitle: normalizeString(lessonTitle),
      organizationId: org.id,
      slug: `e2e-grammar-lesson-${uniqueId}`,
      title: lessonTitle,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      isPublished: true,
      kind: "grammar",
      lessonId: lesson.id,
      organizationId: org.id,
      title: activityTitle,
    });

    await setupMockApis(userWithoutProgress, {
      streamMessages: [
        { status: "started", step: "getLessonActivities" },
        { status: "completed", step: "getLessonActivities" },
        { status: "started", step: "setActivityAsRunning" },
        { status: "completed", step: "setActivityAsRunning" },
        { status: "started", step: "generateGrammarContent" },
        { status: "completed", step: "generateGrammarContent" },
        { status: "started", step: "setGrammarAsCompleted" },
        { status: "completed", step: "setGrammarAsCompleted" },
        { status: "started", step: "setActivityAsCompleted" },
        { status: "completed", step: "setActivityAsCompleted" },
      ],
    });

    await userWithoutProgress.goto(`/generate/a/${activity.id}`);

    await expect(userWithoutProgress.getByText(/your activity is ready/i)).toBeVisible({
      timeout: 10_000,
    });

    await expect(userWithoutProgress.getByText(/taking you to your activity/i)).toBeVisible();

    await prisma.activity.update({
      data: { generationStatus: "completed" },
      where: { id: activity.id },
    });

    await userWithoutProgress.waitForURL(
      new RegExp(
        `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/${activity.position}`,
      ),
      { timeout: 10_000 },
    );
  });

  test("completes workflow for reading activity kind", async ({ userWithoutProgress }) => {
    await createTestSubscription();
    const { activity, chapter, course, lesson } = await createPendingReadingActivity();

    await setupMockApis(userWithoutProgress, {
      streamMessages: [
        { status: "started", step: "getLessonActivities" },
        { status: "completed", step: "getLessonActivities" },
        { status: "started", step: "setActivityAsRunning" },
        { status: "completed", step: "setActivityAsRunning" },
        { status: "started", step: "generateSentences" },
        { status: "completed", step: "generateSentences" },
        { status: "started", step: "saveSentences" },
        { status: "completed", step: "saveSentences" },
        { status: "started", step: "generateAudio" },
        { status: "completed", step: "generateAudio" },
        { status: "started", step: "updateSentenceEnrichments" },
        { status: "completed", step: "updateSentenceEnrichments" },
        { status: "started", step: "setReadingAsCompleted" },
        { status: "completed", step: "setReadingAsCompleted" },
        { status: "started", step: "setActivityAsCompleted" },
        { status: "completed", step: "setActivityAsCompleted" },
      ],
    });

    await userWithoutProgress.goto(`/generate/a/${activity.id}`);

    await expect(userWithoutProgress.getByText(/your activity is ready/i)).toBeVisible({
      timeout: 10_000,
    });

    await expect(userWithoutProgress.getByText(/taking you to your activity/i)).toBeVisible();

    await prisma.activity.update({
      data: { generationStatus: "completed" },
      where: { id: activity.id },
    });

    await userWithoutProgress.waitForURL(
      new RegExp(
        `/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/${activity.position}`,
      ),
      { timeout: 10_000 },
    );
  });

  test("shows practice-content phase and skips pronunciation phase for reading", async ({
    userWithoutProgress,
  }) => {
    await createTestSubscription();

    const { activity } = await createPendingReadingActivity();

    await setupMockApis(userWithoutProgress, {
      streamDelayMs: 15_000,
      streamMessages: [{ status: "started", step: "getLessonActivities" }],
    });

    await userWithoutProgress.goto(`/generate/a/${activity.id}`);

    await expect(userWithoutProgress.getByText(/preparing practice content/i)).toBeVisible({
      timeout: 10_000,
    });

    await expect(userWithoutProgress.getByText(/adding pronunciation/i)).toHaveCount(0);
  });

  test("shows error when stream returns error status", async ({ userWithoutProgress }) => {
    await createTestSubscription();
    const { activity } = await createPendingActivity();

    await setupMockApis(userWithoutProgress, {
      streamMessages: [
        { status: "started", step: "getLessonActivities" },
        { status: "error", step: "getLessonActivities" },
      ],
    });

    await userWithoutProgress.goto(`/generate/a/${activity.id}`);

    await expect(userWithoutProgress.getByText(/something went wrong/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("shows error on premature stream end without completion step", async ({
    userWithoutProgress,
  }) => {
    await createTestSubscription();
    const { activity } = await createPendingActivity();

    // Stream ends after just a couple of steps, without completion
    await setupMockApis(userWithoutProgress, {
      streamMessages: [
        { status: "started", step: "getLessonActivities" },
        { status: "completed", step: "getLessonActivities" },
        { status: "started", step: "generateBackgroundContent" },
        { status: "completed", step: "generateBackgroundContent" },
      ],
    });

    await userWithoutProgress.goto(`/generate/a/${activity.id}`);

    // Should show error because completion step was never received
    await expect(
      userWithoutProgress.getByRole("alert").filter({ hasText: /something went wrong/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("shows error when trigger API fails", async ({ userWithoutProgress }) => {
    await createTestSubscription();
    const { activity } = await createPendingActivity();

    await setupMockApis(userWithoutProgress, {
      triggerResponse: { error: "Internal server error", status: 500 },
    });

    await userWithoutProgress.goto(`/generate/a/${activity.id}`);

    await expect(userWithoutProgress.getByText(/something went wrong/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("shows retry button on error", async ({ userWithoutProgress }) => {
    await createTestSubscription();
    const { activity } = await createPendingActivity();

    await setupMockApis(userWithoutProgress, {
      streamMessages: [
        { status: "started", step: "getLessonActivities" },
        { status: "error", step: "workflowError" },
      ],
    });

    await userWithoutProgress.goto(`/generate/a/${activity.id}`);

    await expect(userWithoutProgress.getByText(/something went wrong/i)).toBeVisible({
      timeout: 10_000,
    });

    await expect(userWithoutProgress.getByRole("button", { name: /try again/i })).toBeVisible();
  });
});

test.describe("Generate Activity Page - Not Found", () => {
  test("invalid activity ID shows 404 page", async ({ page }) => {
    await page.goto("/generate/a/999999");
    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });

  test("non-numeric activity ID shows 404 page", async ({ page }) => {
    await page.goto("/generate/a/invalid-id");
    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });
});
