import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { type Page, type Route } from "@zoonk/e2e/fixtures";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { normalizeString } from "@zoonk/utils/string";
import { expect, test } from "./fixtures";

/**
 * Test Architecture for Chapter Generation Page
 *
 * The generation page has 3 access states:
 * 1. Unauthenticated - Shows login prompt
 * 2. Authenticated without subscription - Shows upgrade CTA
 * 3. Authenticated with subscription - Shows generation UI
 *
 * The generation flow interacts with 2 APIs on the API server:
 * 1. POST ${API_BASE_URL}/v1/workflows/chapter-generation/trigger - Starts the workflow, returns { runId: string }
 * 2. GET ${API_BASE_URL}/v1/workflows/chapter-generation/status?runId=X&startIndex=N - Returns SSE stream of step updates
 */

const TEST_RUN_ID = "test-run-id-chapter-12345";
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
    if (url.includes("/v1/workflows/chapter-generation/trigger") && method === "POST") {
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
    if (url.includes("/v1/workflows/chapter-generation/status")) {
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
 * Sets up route interception for chapter generation APIs.
 */
async function setupMockApis(page: Page, options: MockApiOptions = {}): Promise<void> {
  const handler = createRouteHandler(options);
  await page.route("**/v1/workflows/chapter-generation/**", handler);
}

/**
 * Gets a chapter ID with pending generation status for testing.
 * Uses the seeded e2e-no-lessons-chapter for tests that don't need isolation.
 */
async function getPendingChapterId(): Promise<number> {
  const chapter = await prisma.chapter.findFirst({
    select: { id: true },
    where: {
      generationStatus: "pending",
      slug: "e2e-no-lessons-chapter",
    },
  });

  if (!chapter) {
    throw new Error("No pending chapter found for E2E testing");
  }

  return chapter.id;
}

/**
 * Creates a chapter with pending generation status for testing the generation workflow.
 */
async function createPendingChapter() {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

  const uniqueId = randomUUID().slice(0, 8);
  const courseTitle = `E2E Generation Course ${uniqueId}`;
  const chapterTitle = `E2E Generation Chapter ${uniqueId}`;

  const course = await courseFixture({
    isPublished: true,
    normalizedTitle: normalizeString(courseTitle),
    organizationId: org.id,
    slug: `e2e-gen-course-${uniqueId}`,
    title: courseTitle,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    generationStatus: "pending",
    isPublished: true,
    normalizedTitle: normalizeString(chapterTitle),
    organizationId: org.id,
    slug: `e2e-gen-chapter-${uniqueId}`,
    title: chapterTitle,
  });

  return { chapter, course, organizationId: org.id };
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
      stripeCustomerId: `cus_test_e2e_${uniqueId}`,
      stripeSubscriptionId: `sub_test_e2e_${uniqueId}`,
    },
  });

  return subscription;
}

test.describe("Generate Chapter Page - Unauthenticated", () => {
  test("shows login prompt with link to login page", async ({ page }) => {
    const chapterId = await getPendingChapterId();
    await page.goto(`/generate/ch/${chapterId}`);

    await expect(page.getByRole("alert").filter({ hasText: /logged in/i })).toBeVisible();

    const loginLink = page.getByRole("link", { name: /login/i });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute("href", "/login");
  });
});

test.describe("Generate Chapter Page - No Subscription", () => {
  test("shows upgrade CTA when authenticated without subscription", async ({
    authenticatedPage,
  }) => {
    const chapterId = await getPendingChapterId();
    await authenticatedPage.goto(`/generate/ch/${chapterId}`);

    await expect(authenticatedPage.getByText(/upgrade to generate/i)).toBeVisible();

    await expect(authenticatedPage.getByRole("button", { name: /upgrade/i })).toBeVisible();
  });

  test("upgrade button shows loading state when clicked", async ({ authenticatedPage }) => {
    const chapterId = await getPendingChapterId();
    await authenticatedPage.goto(`/generate/ch/${chapterId}`);

    const upgradeButton = authenticatedPage.getByRole("button", {
      name: /upgrade/i,
    });

    await upgradeButton.click();
    await expect(upgradeButton).toBeDisabled();
  });
});

test.describe("Generate Chapter Page - With Subscription", () => {
  test("shows generation UI and completes workflow", async ({ userWithoutProgress }) => {
    await createTestSubscription();
    const { chapter, organizationId } = await createPendingChapter();

    // Create a lesson so the chapter page doesn't redirect back to /generate
    const uniqueId = randomUUID().slice(0, 8);
    await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId,
      slug: `e2e-generated-lesson-${uniqueId}`,
      title: `E2E Generated Lesson ${uniqueId}`,
    });

    await setupMockApis(userWithoutProgress, {
      streamMessages: [
        { status: "started", step: "getChapter" },
        { status: "completed", step: "getChapter" },
        { status: "started", step: "setChapterAsRunning" },
        { status: "completed", step: "setChapterAsRunning" },
        { status: "started", step: "generateLessons" },
        { status: "completed", step: "generateLessons" },
        { status: "started", step: "addLessons" },
        { status: "completed", step: "addLessons" },
        { status: "started", step: "setChapterAsCompleted" },
        { status: "completed", step: "setChapterAsCompleted" },
        { status: "started", step: "setLessonAsCompleted" },
        { status: "completed", step: "setLessonAsCompleted" },
        { status: "started", step: "setActivityAsCompleted" },
        { status: "completed", step: "setActivityAsCompleted" },
      ],
    });

    await userWithoutProgress.goto(`/generate/ch/${chapter.id}`);

    // Should show completion message
    await expect(userWithoutProgress.getByText(/chapter generated/i)).toBeVisible({
      timeout: 10_000,
    });

    await expect(userWithoutProgress.getByText(/redirecting to your chapter/i)).toBeVisible();

    // Update chapter status - the redirect will happen in ~1.5s via location.href
    await prisma.chapter.update({
      data: { generationStatus: "completed" },
      where: { id: chapter.id },
    });

    // Should redirect to chapter page
    await userWithoutProgress.waitForURL(/\/b\/ai\/c\//, { timeout: 10_000 });
  });

  test("shows error when stream returns error status", async ({ userWithoutProgress }) => {
    await createTestSubscription();
    const chapterId = await getPendingChapterId();

    await setupMockApis(userWithoutProgress, {
      streamMessages: [
        { status: "started", step: "getChapter" },
        { status: "error", step: "getChapter" },
      ],
    });

    await userWithoutProgress.goto(`/generate/ch/${chapterId}`);

    await expect(userWithoutProgress.getByText(/generation failed/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("Generate Chapter Page - Not Found", () => {
  test("invalid chapter ID shows 404 page", async ({ page }) => {
    await page.goto("/generate/ch/999999");
    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });

  test("non-numeric chapter ID shows 404 page", async ({ page }) => {
    await page.goto("/generate/ch/invalid-id");
    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });
});
