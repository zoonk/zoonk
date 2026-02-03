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
 * Test Architecture for Lesson Generation Page
 *
 * The generation page has 3 access states:
 * 1. Unauthenticated - Shows login prompt
 * 2. Authenticated without subscription - Shows upgrade CTA
 * 3. Authenticated with subscription - Shows generation UI
 *
 * The generation flow interacts with 2 APIs on the API server:
 * 1. POST ${API_BASE_URL}/v1/workflows/lesson-generation/trigger - Starts the workflow, returns { runId: string }
 * 2. GET ${API_BASE_URL}/v1/workflows/lesson-generation/status?runId=X&startIndex=N - Returns SSE stream of step updates
 */

const TEST_RUN_ID = "test-run-id-lesson-12345";
const TEST_USER_EMAIL = "e2e-new@zoonk.test";

type MockApiOptions = {
  triggerResponse?: { runId?: string; error?: string; status?: number };
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
    streamMessages = [],
    streamError = false,
  } = options;

  return async (route: Route) => {
    const url = route.request().url();
    const method = route.request().method();

    // Mock trigger API
    if (url.includes("/v1/workflows/lesson-generation/trigger") && method === "POST") {
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
    if (url.includes("/v1/workflows/lesson-generation/status")) {
      if (streamError) {
        await route.abort("failed");
        return;
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
 * Sets up route interception for lesson generation APIs.
 */
async function setupMockApis(page: Page, options: MockApiOptions = {}): Promise<void> {
  const handler = createRouteHandler(options);
  await page.route("**/v1/workflows/lesson-generation/**", handler);
}

/**
 * Creates a lesson with pending generation status for testing the generation workflow.
 */
async function createPendingLesson() {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

  const uniqueId = randomUUID().slice(0, 8);
  const courseTitle = `E2E Lesson Course ${uniqueId}`;
  const chapterTitle = `E2E Lesson Chapter ${uniqueId}`;
  const lessonTitle = `E2E Generation Lesson ${uniqueId}`;

  const course = await courseFixture({
    isPublished: true,
    normalizedTitle: normalizeString(courseTitle),
    organizationId: org.id,
    slug: `e2e-lesson-course-${uniqueId}`,
    title: courseTitle,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    generationStatus: "completed",
    isPublished: true,
    normalizedTitle: normalizeString(chapterTitle),
    organizationId: org.id,
    slug: `e2e-lesson-chapter-${uniqueId}`,
    title: chapterTitle,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    generationStatus: "pending",
    isPublished: true,
    normalizedTitle: normalizeString(lessonTitle),
    organizationId: org.id,
    slug: `e2e-gen-lesson-${uniqueId}`,
    title: lessonTitle,
  });

  return { chapter, course, lesson, organizationId: org.id };
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
      stripeCustomerId: `cus_test_e2e_lesson_${uniqueId}`,
      stripeSubscriptionId: `sub_test_e2e_lesson_${uniqueId}`,
    },
  });

  return subscription;
}

test.describe("Generate Lesson Page - Unauthenticated", () => {
  test("shows login prompt with link to login page", async ({ page }) => {
    const { lesson } = await createPendingLesson();
    await page.goto(`/generate/l/${lesson.id}`);

    await expect(page.getByRole("alert").filter({ hasText: /logged in/i })).toBeVisible();

    const loginLink = page.getByRole("link", { name: /login/i });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute("href", "/login");
  });
});

test.describe("Generate Lesson Page - No Subscription", () => {
  test("shows upgrade CTA when authenticated without subscription", async ({
    authenticatedPage,
  }) => {
    const { lesson } = await createPendingLesson();
    await authenticatedPage.goto(`/generate/l/${lesson.id}`);

    await expect(authenticatedPage.getByText(/upgrade to generate/i)).toBeVisible();

    await expect(authenticatedPage.getByRole("button", { name: /upgrade/i })).toBeVisible();
  });

  test("upgrade button shows loading state when clicked", async ({ authenticatedPage }) => {
    const { lesson } = await createPendingLesson();
    await authenticatedPage.goto(`/generate/l/${lesson.id}`);

    const upgradeButton = authenticatedPage.getByRole("button", {
      name: /upgrade/i,
    });

    await upgradeButton.click();
    await expect(upgradeButton).toBeDisabled();
  });
});

test.describe("Generate Lesson Page - With Subscription", () => {
  test("shows generation UI and completes workflow", async ({ userWithoutProgress }) => {
    await createTestSubscription();
    const { lesson, organizationId } = await createPendingLesson();

    // Create an activity so the lesson page doesn't redirect back to /generate
    const uniqueId = randomUUID().slice(0, 8);
    await activityFixture({
      isPublished: true,
      lessonId: lesson.id,
      organizationId,
      title: `E2E Generated Activity ${uniqueId}`,
    });

    await setupMockApis(userWithoutProgress, {
      streamMessages: [
        { status: "started", step: "getLesson" },
        { status: "completed", step: "getLesson" },
        { status: "started", step: "setLessonAsRunning" },
        { status: "completed", step: "setLessonAsRunning" },
        { status: "started", step: "determineLessonKind" },
        { status: "completed", step: "determineLessonKind" },
        { status: "started", step: "updateLessonKind" },
        { status: "completed", step: "updateLessonKind" },
        { status: "started", step: "generateCustomActivities" },
        { status: "completed", step: "generateCustomActivities" },
        { status: "started", step: "addActivities" },
        { status: "completed", step: "addActivities" },
        { status: "started", step: "setLessonAsCompleted" },
        { status: "completed", step: "setLessonAsCompleted" },
      ],
    });

    await userWithoutProgress.goto(`/generate/l/${lesson.id}`);

    // Should show completion message
    await expect(userWithoutProgress.getByText(/activities generated/i)).toBeVisible({
      timeout: 10_000,
    });

    await expect(userWithoutProgress.getByText(/redirecting to your lesson/i)).toBeVisible();

    // Update lesson status - the redirect will happen in ~1.5s via location.href
    await prisma.lesson.update({
      data: { generationStatus: "completed" },
      where: { id: lesson.id },
    });

    // Should redirect to lesson page
    await userWithoutProgress.waitForURL(/\/b\/ai\/c\//, { timeout: 10_000 });
  });

  test("shows error when stream returns error status", async ({ userWithoutProgress }) => {
    await createTestSubscription();
    const { lesson } = await createPendingLesson();

    await setupMockApis(userWithoutProgress, {
      streamMessages: [
        { status: "started", step: "getLesson" },
        { status: "error", step: "getLesson" },
      ],
    });

    await userWithoutProgress.goto(`/generate/l/${lesson.id}`);

    await expect(userWithoutProgress.getByText(/generation failed/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("Generate Lesson Page - Not Found", () => {
  test("invalid lesson ID shows 404 page", async ({ page }) => {
    await page.goto("/generate/l/999999");
    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });

  test("non-numeric lesson ID shows 404 page", async ({ page }) => {
    await page.goto("/generate/l/invalid-id");
    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });
});
