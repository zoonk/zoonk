import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { type Page, type Route } from "@zoonk/e2e/fixtures";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { normalizeString } from "@zoonk/utils/string";
import { expect, test } from "./fixtures";
import {
  type GenerationTriggerResponse,
  getGenerationLimitResponse,
  isGenerationEvents,
  isGenerationTrigger,
  routeGenerationApis,
} from "./generation-api";

/**
 * Test Architecture for Chapter Generation Page
 *
 * The generation page has 3 access states:
 * 1. First chapter - Shows generation UI without login
 * 2. Authenticated without subscription - Shows upgrade CTA
 * 3. Authenticated with subscription - Shows generation UI
 *
 * The generation flow interacts with 2 APIs on the API server:
 * 1. POST ${API_BASE_URL}/v1/generations - Starts the workflow, returns the generation resource
 * 2. GET ${API_BASE_URL}/v1/generations/{generationId}/events?startIndex=N - Returns SSE stream of step updates
 */

const TEST_RUN_ID = "test-run-id-chapter-12345";

type MockApiOptions = {
  triggerResponse?: GenerationTriggerResponse;
  streamMessages?: { reason?: string; step: string; status: string }[];
  streamError?: boolean;
  statusDelayMs?: number;
};

/**
 * Creates a mock SSE stream response from an array of messages.
 */
function createSSEStream(messages: { reason?: string; step: string; status: string }[]): string {
  return messages.map((msg) => `data: ${JSON.stringify(msg)}\n\n`).join("");
}

/**
 * Creates the route handler function for mocking APIs.
 */
function createRouteHandler(options: MockApiOptions) {
  const {
    statusDelayMs = 0,
    triggerResponse = { id: TEST_RUN_ID },
    streamMessages = [],
    streamError = false,
  } = options;

  return async (route: Route) => {
    const url = route.request().url();

    // Mock trigger API
    if (isGenerationTrigger({ request: route.request(), targetType: "chapter" })) {
      if (triggerResponse.error || (triggerResponse.status && triggerResponse.status >= 400)) {
        await route.fulfill({
          body: JSON.stringify(triggerResponse.body ?? { error: triggerResponse.error }),
          contentType: "application/json",
          status: triggerResponse.status ?? 500,
        });

        return;
      }

      await route.fulfill({
        body: JSON.stringify({ id: triggerResponse.id, status: "pending" }),
        contentType: "application/json",
        status: 202,
      });

      return;
    }

    // Mock event stream API
    if (isGenerationEvents(url)) {
      if (streamError) {
        await route.abort("failed");
        return;
      }

      if (statusDelayMs > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, statusDelayMs);
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
 * Sets up route interception for chapter generation APIs.
 */
async function setupMockApis(page: Page, options: MockApiOptions = {}): Promise<void> {
  const handler = createRouteHandler(options);
  await routeGenerationApis({ handler, page });
}

/**
 * Creates a chapter with pending generation status for testing the generation workflow.
 */
async function createPendingChapter(position = 0) {
  const org = await getAiOrganization();

  const uniqueId = randomUUID().slice(0, 8);
  const courseTitle = `E2E Generation Course ${uniqueId}`;
  const chapterTitle = `E2E Generation Chapter ${uniqueId}`;

  const course = await courseFixture({
    isPublished: true,
    normalizedTitle: normalizeString(courseTitle),
    organizationId: org.id,
    slug: `e2e-gen-course-${uniqueId}`,
    targetLanguage: null,
    title: courseTitle,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    generationStatus: "pending",
    isPublished: true,
    normalizedTitle: normalizeString(chapterTitle),
    organizationId: org.id,
    position,
    slug: `e2e-gen-chapter-${uniqueId}`,
    title: chapterTitle,
  });

  return { chapter, course, organizationId: org.id };
}

/**
 * Creates a test subscription for the given user.
 */
async function createTestSubscription(userId: string) {
  const uniqueId = randomUUID();

  const subscription = await prisma.subscription.create({
    data: {
      id: randomUUID(),
      plan: "plus",
      referenceId: userId,
      status: "active",
      stripeCustomerId: `cus_test_e2e_${uniqueId}`,
      stripeSubscriptionId: `sub_test_e2e_${uniqueId}`,
    },
  });

  return subscription;
}

test.describe("Generate Chapter Page - Unauthenticated", () => {
  test("explains when the daily chapter generation limit is reached", async ({ page }) => {
    const { chapter } = await createPendingChapter();

    await setupMockApis(page, {
      triggerResponse: getGenerationLimitResponse({
        period: "day",
        resource: "chapter",
        viewer: "guest",
      }),
    });

    await page.goto(`/generate/ch/${chapter.id}`);

    await expect(page.getByRole("heading", { name: "Daily chapter limit reached" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  });

  test("shows upgrade CTA for later chapters", async ({ page }) => {
    const { chapter } = await createPendingChapter(1);
    await page.goto(`/generate/ch/${chapter.id}`);

    await expect(page.getByText(/^keep learning with plus$/iu)).toBeVisible();

    const upgradeLink = page.getByRole("link", { name: /get zoonk plus/iu });
    await expect(upgradeLink).toBeVisible();
    await expect(upgradeLink).toHaveAttribute("href", /\/subscription/u);
  });
});

test.describe("Generate Chapter Page - No Subscription", () => {
  test("shows upgrade CTA with link to subscription page", async ({ authenticatedPage }) => {
    const { chapter } = await createPendingChapter(1);
    await authenticatedPage.goto(`/generate/ch/${chapter.id}`);

    await expect(authenticatedPage.getByText(/^keep learning with plus$/iu)).toBeVisible();

    const upgradeLink = authenticatedPage.getByRole("link", { name: /get zoonk plus/iu });
    await expect(upgradeLink).toBeVisible();
    await expect(upgradeLink).toHaveAttribute("href", /\/subscription/u);
  });

  test("requires subscription to retry failed later-chapter generation", async ({
    authenticatedPage,
  }) => {
    const { chapter } = await createPendingChapter(1);

    await prisma.chapter.update({
      data: { generationStatus: "failed" },
      where: { id: chapter.id },
    });

    await setupMockApis(authenticatedPage, {
      statusDelayMs: 2500,
      streamMessages: [{ status: "started", step: "getChapter" }],
    });

    await authenticatedPage.goto(`/generate/ch/${chapter.id}`);

    await expect(authenticatedPage.getByText(/^keep learning with plus$/iu)).toBeVisible();
  });
});

test.describe("Generate Chapter Page - With Subscription", () => {
  test("shows completion UI before redirecting when chapter is already ready", async ({
    authenticatedPage,
  }) => {
    const { chapter, course, organizationId } = await createPendingChapter();
    const uniqueId = randomUUID().slice(0, 8);

    await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId,
        slug: `e2e-ready-lesson-${uniqueId}`,
        title: `E2E Ready Lesson ${uniqueId}`,
      }),
      prisma.chapter.update({ data: { generationStatus: "completed" }, where: { id: chapter.id } }),
    ]);

    await authenticatedPage.goto(`/generate/ch/${chapter.id}`);

    await expect(authenticatedPage.getByText(/your lessons are ready/iu)).toBeVisible();
    await expect(authenticatedPage.getByText(/taking you to your chapter/iu)).toBeVisible();
    expect(await authenticatedPage.getByRole("link", { name: /back to course/iu }).count()).toBe(0);

    await authenticatedPage.waitForURL(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}`, {
      timeout: 10_000,
    });
  });

  test("shows generation UI and completes workflow", async ({
    userWithoutProgress,
    noProgressUser,
  }) => {
    await createTestSubscription(noProgressUser.id);
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
      ],
    });

    await userWithoutProgress.goto(`/generate/ch/${chapter.id}`);

    // Should show completion message
    await expect(userWithoutProgress.getByText(/your lessons are ready/iu)).toBeVisible({
      timeout: 10_000,
    });

    await expect(userWithoutProgress.getByText(/taking you to your chapter/iu)).toBeVisible();

    // Update chapter status - the redirect will happen in ~1.5s via location.href
    await prisma.chapter.update({
      data: { generationStatus: "completed" },
      where: { id: chapter.id },
    });

    // Should redirect to chapter page
    await userWithoutProgress.waitForURL(/\/b\/ai\/c\//u, { timeout: 10_000 });
  });

  test("reconnects and completes when stream is cut off before completion step", async ({
    userWithoutProgress,
    noProgressUser,
  }) => {
    await createTestSubscription(noProgressUser.id);
    const { chapter, organizationId } = await createPendingChapter();

    const uniqueId = randomUUID().slice(0, 8);

    await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId,
      slug: `e2e-reconnect-lesson-${uniqueId}`,
      title: `E2E Reconnect Lesson ${uniqueId}`,
    });

    const partialMessages = [
      { status: "started", step: "getChapter" },
      { status: "completed", step: "getChapter" },
      { status: "started", step: "generateLessons" },
      { status: "completed", step: "generateLessons" },
    ];

    const remainingMessages = [
      { status: "started", step: "setChapterAsCompleted" },
      { status: "completed", step: "setChapterAsCompleted" },
    ];

    /**
     * Simulate a stream cutoff by serving partial messages on the first request
     * and the remaining messages (including the completion step) on reconnection.
     * The client uses `startIndex` to resume from where it left off.
     */
    let statusRequestCount = 0;

    await routeGenerationApis({
      handler: async (route) => {
        const url = route.request().url();

        if (isGenerationTrigger({ request: route.request(), targetType: "chapter" })) {
          await route.fulfill({
            body: JSON.stringify({ id: TEST_RUN_ID, status: "pending" }),
            contentType: "application/json",
            status: 202,
          });

          return;
        }

        if (isGenerationEvents(url)) {
          statusRequestCount += 1;
          const messages = statusRequestCount === 1 ? partialMessages : remainingMessages;

          await route.fulfill({
            body: createSSEStream(messages),
            contentType: "text/event-stream",
            status: 200,
          });

          return;
        }

        await route.continue();
      },
      page: userWithoutProgress,
    });

    await userWithoutProgress.goto(`/generate/ch/${chapter.id}`);

    await expect(userWithoutProgress.getByText(/your lessons are ready/iu)).toBeVisible({
      timeout: 15_000,
    });

    await prisma.chapter.update({
      data: { generationStatus: "completed" },
      where: { id: chapter.id },
    });

    await userWithoutProgress.waitForURL(/\/b\/ai\/c\//u, { timeout: 10_000 });
  });

  test("keeps checking progress when the status connection is interrupted", async ({
    userWithoutProgress,
    noProgressUser,
  }) => {
    await createTestSubscription(noProgressUser.id);
    const { chapter, organizationId } = await createPendingChapter();

    const uniqueId = randomUUID().slice(0, 8);

    await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId,
      slug: `e2e-interrupted-lesson-${uniqueId}`,
      title: `E2E Interrupted Lesson ${uniqueId}`,
    });

    await routeGenerationApis({
      handler: async (route) => {
        const url = route.request().url();

        if (isGenerationTrigger({ request: route.request(), targetType: "chapter" })) {
          await route.fulfill({
            body: JSON.stringify({ id: TEST_RUN_ID, status: "pending" }),
            contentType: "application/json",
            status: 202,
          });

          return;
        }

        if (isGenerationEvents(url)) {
          const reconnectCount = new URL(url).searchParams.get("_rc");

          if (reconnectCount === "0") {
            await route.abort("failed");
            return;
          }

          await route.fulfill({
            body: createSSEStream([
              { status: "started", step: "setChapterAsCompleted" },
              { status: "completed", step: "setChapterAsCompleted" },
            ]),
            contentType: "text/event-stream",
            status: 200,
          });

          return;
        }

        await route.continue();
      },
      page: userWithoutProgress,
    });

    await userWithoutProgress.goto(`/generate/ch/${chapter.id}`);

    await expect(userWithoutProgress.getByText(/something went wrong/iu)).toHaveCount(0);

    await expect(userWithoutProgress.getByText(/your lessons are ready/iu)).toBeVisible({
      timeout: 15_000,
    });

    await prisma.chapter.update({
      data: { generationStatus: "completed" },
      where: { id: chapter.id },
    });

    await userWithoutProgress.waitForURL(/\/b\/ai\/c\//u, { timeout: 10_000 });
  });

  test("checks server state when connection retry is clicked", async ({
    userWithoutProgress,
    noProgressUser,
  }) => {
    await createTestSubscription(noProgressUser.id);
    const { chapter, organizationId } = await createPendingChapter();

    const uniqueId = randomUUID().slice(0, 8);

    await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId,
      slug: `e2e-retry-lesson-${uniqueId}`,
      title: `E2E Retry Lesson ${uniqueId}`,
    });

    await routeGenerationApis({
      handler: async (route) => {
        const url = route.request().url();

        if (isGenerationTrigger({ request: route.request(), targetType: "chapter" })) {
          await route.fulfill({
            body: JSON.stringify({ id: TEST_RUN_ID, status: "pending" }),
            contentType: "application/json",
            status: 202,
          });

          return;
        }

        if (isGenerationEvents(url)) {
          await route.abort("failed");
          return;
        }

        await route.continue();
      },
      page: userWithoutProgress,
    });

    await userWithoutProgress.goto(`/generate/ch/${chapter.id}`);

    await expect(userWithoutProgress.getByText(/connection interrupted/iu)).toBeVisible({
      timeout: 12_000,
    });

    await prisma.chapter.update({
      data: { generationStatus: "completed" },
      where: { id: chapter.id },
    });

    await userWithoutProgress.getByRole("button", { name: /check again/iu }).click();
    await userWithoutProgress.waitForURL(/\/b\/ai\/c\//u, { timeout: 10_000 });
  });

  test("shows error when stream returns error status", async ({
    userWithoutProgress,
    noProgressUser,
  }) => {
    await createTestSubscription(noProgressUser.id);
    const { chapter } = await createPendingChapter();

    await setupMockApis(userWithoutProgress, {
      streamMessages: [
        { status: "started", step: "getChapter" },
        { reason: "notFound", status: "error", step: "getChapter" },
      ],
    });

    await userWithoutProgress.goto(`/generate/ch/${chapter.id}`);

    await expect(userWithoutProgress.getByText(/something went wrong/iu)).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("Generate Chapter Page - First Chapter Free", () => {
  test("unauthenticated user sees generation UI for first chapter", async ({ page }) => {
    const { chapter } = await createPendingChapter(0);

    await setupMockApis(page, {
      statusDelayMs: 2500,
      streamMessages: [{ status: "started", step: "getChapter" }],
    });

    await page.goto(`/generate/ch/${chapter.id}`);

    await expect(page.getByText(/^keep learning with plus$/iu)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: chapter.title })).toBeVisible();
  });

  test("authenticated user without subscription sees generation UI for first chapter", async ({
    authenticatedPage,
  }) => {
    const { chapter } = await createPendingChapter(0);

    await setupMockApis(authenticatedPage, {
      statusDelayMs: 2500,
      streamMessages: [{ status: "started", step: "getChapter" }],
    });

    await authenticatedPage.goto(`/generate/ch/${chapter.id}`);

    await expect(authenticatedPage.getByText(/^keep learning with plus$/iu)).toHaveCount(0);
    await expect(authenticatedPage.getByRole("heading", { name: chapter.title })).toBeVisible();
  });
});

test.describe("Generate Chapter Page - Running Later Chapter Requires Subscription", () => {
  test("unauthenticated user sees upgrade CTA for non-first chapter when status is running", async ({
    page,
  }) => {
    const org = await getAiOrganization();
    const uniqueId = randomUUID().slice(0, 8);

    const course = await courseFixture({
      isPublished: true,
      normalizedTitle: normalizeString(`E2E Running Chapter Course ${uniqueId}`),
      organizationId: org.id,
      slug: `e2e-running-chapter-course-${uniqueId}`,
      targetLanguage: null,
      title: `E2E Running Chapter Course ${uniqueId}`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      generationRunId: `run-${uniqueId}`,
      generationStatus: "running",
      isPublished: true,
      normalizedTitle: normalizeString(`E2E Running Chapter ${uniqueId}`),
      organizationId: org.id,
      position: 1,
      slug: `e2e-running-chapter-${uniqueId}`,
      title: `E2E Running Chapter ${uniqueId}`,
    });

    await page.goto(`/generate/ch/${chapter.id}`);

    await expect(page.getByText(/^keep learning with plus$/iu)).toBeVisible();

    await expect(
      page.getByText(
        "Plus gives you unlimited courses and lessons for whatever you want to learn.",
      ),
    ).toBeVisible();
  });
});

test.describe("Generate Chapter Page - Not Found", () => {
  test("invalid chapter ID shows 404 page", async ({ page }) => {
    await page.goto("/generate/ch/999999");
    await expect(page.getByText(/not found|404/iu)).toBeVisible();
  });

  test("non-numeric chapter ID shows 404 page", async ({ page }) => {
    await page.goto("/generate/ch/invalid-id");
    await expect(page.getByText(/not found|404/iu)).toBeVisible();
  });
});
