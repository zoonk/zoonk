import { randomUUID } from "node:crypto";
import { type Page, type Route } from "@zoonk/e2e/fixtures";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseSuggestionFixture } from "@zoonk/testing/fixtures/course-suggestions";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { expect, test } from "./fixtures";

/**
 * Test Architecture for Course Generation Page
 *
 * The generation page interacts with 2 APIs on the API server:
 * 1. POST ${API_BASE_URL}/v1/workflows/course-generation/trigger - Starts the workflow, returns { runId: string }
 * 2. GET ${API_BASE_URL}/v1/workflows/course-generation/status?runId=X&startIndex=N - Returns SSE stream of step updates
 *
 * Client behavior:
 * - Auto-triggers workflow on mount (no idle state)
 * - Shows "Creating your course" while triggering/streaming
 * - Shows current step label + spinner while streaming
 * - Shows completed steps with checkmarks
 * - Workflow completes when the SSE stream ends
 * - Redirects to course page when workflow completes
 *
 * NOTE: Some error handling tests (trigger API failures) are not included because
 * the POST trigger request happens too quickly during page load for Playwright's
 * route interception to reliably catch it. Those scenarios should be tested via
 * integration tests or by testing the client component in isolation.
 */

const TEST_RUN_ID = "test-run-id-12345";

type MockApiOptions = {
  triggerResponse?: { runId?: string; error?: string; status?: number };
  streamMessages?: { reason?: string; step: string; status: string }[];
  streamError?: boolean;
  statusDelayMs?: number;
};

/**
 * Creates a mock SSE stream response from an array of messages.
 * Each message follows the SSE format: "data: {...}\n\n"
 */
function createSSEStream(messages: { reason?: string; step: string; status: string }[]): string {
  return messages.map((msg) => `data: ${JSON.stringify(msg)}\n\n`).join("");
}

/**
 * Creates the route handler function for mocking APIs.
 * Extracted to reduce complexity in test functions.
 */
function createRouteHandler(options: MockApiOptions) {
  const {
    statusDelayMs = 0,
    triggerResponse = { runId: TEST_RUN_ID },
    streamMessages = [],
    streamError = false,
  } = options;

  return async (route: Route) => {
    const url = route.request().url();
    const method = route.request().method();

    // Mock trigger API
    if (url.includes("/v1/workflows/course-generation/trigger") && method === "POST") {
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
    if (url.includes("/v1/workflows/course-generation/status")) {
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
 * Sets up route interception for course generation APIs.
 * Only intercepts specific API routes to avoid interfering with page navigation.
 * Must be called BEFORE navigation.
 */
async function setupMockApis(page: Page, options: MockApiOptions = {}): Promise<void> {
  const handler = createRouteHandler(options);
  await page.route("**/v1/workflows/course-generation/**", handler);
}

test.describe("Generate Course Page", () => {
  test.describe("Initial triggering state", () => {
    test("shows triggering state immediately on page load", async ({ page }) => {
      // Create a unique suggestion to avoid PPR caching issues with seeded data
      const slug = `e2e-trigger-${randomUUID().slice(0, 8)}`;
      const suggestion = await courseSuggestionFixture({
        generationStatus: "running",
        language: "en",
        slug,
        title: "E2E Triggering Test",
      });

      // Set up route mocking before navigation
      await setupMockApis(page, {
        streamMessages: [{ status: "started", step: "getCourseSuggestion" }],
      });

      // Navigate directly to the generate page with the unique suggestion
      await page.goto(`/generate/cs/${suggestion.id}`);

      // Should show triggering or streaming state (no idle state)
      await expect(page.getByText(/creating your course/i)).toBeVisible({
        timeout: 10_000,
      });

      await expect(page.getByText(/this usually takes 4-6 minutes/i)).toBeVisible();
    });

    test("shows vocabulary-specific activity phases for language courses", async ({ page }) => {
      const slug = `e2e-language-status-${randomUUID().slice(0, 8)}`;
      const suggestion = await courseSuggestionFixture({
        generationStatus: "running",
        language: "en",
        slug,
        targetLanguage: "es",
        title: "E2E Language Course Status",
      });

      await setupMockApis(page, {
        statusDelayMs: 2500,
        streamMessages: [{ status: "started", step: "getCourseSuggestion" }],
      });

      await page.goto(`/generate/cs/${suggestion.id}`);

      await expect(page.getByText(/preparing practice content/i)).toBeVisible({
        timeout: 10_000,
      });

      await expect(page.getByText(/adding pronunciation/i)).toBeVisible();
      await expect(page.getByText(/recording audio/i)).toBeVisible();
      await expect(page.getByText(/writing the lesson content/i)).toHaveCount(0);
      await expect(page.getByText(/preparing illustrations/i)).toHaveCount(0);
      await expect(page.getByText(/creating images/i)).toHaveCount(0);
    });
  });

  test.describe("Workflow completion and redirect", () => {
    test("shows completion state and redirects to course page", async ({ page }) => {
      const slug = `e2e-completion-${randomUUID().slice(0, 8)}`;
      const org = await getAiOrganization();

      const suggestion = await courseSuggestionFixture({
        generationStatus: "pending",
        language: "en",
        slug,
        title: "E2E Completion Test",
      });

      // Create a real course so the redirect after "completion" works
      const course = await courseFixture({
        isPublished: true,
        organizationId: org.id,
        slug,
        title: "E2E Completion Test",
      });

      const chapter = await chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: org.id,
      });

      await lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId: org.id,
      });

      await setupMockApis(page, {
        streamMessages: [
          { status: "started", step: "getCourseSuggestion" },
          { status: "completed", step: "getCourseSuggestion" },
          { status: "started", step: "addLessons" },
          { status: "completed", step: "addLessons" },
          { status: "started", step: "setLessonAsCompleted" },
          { status: "completed", step: "setLessonAsCompleted" },
          { status: "started", step: "setActivityAsCompleted" },
          { status: "completed", step: "setActivityAsCompleted" },
        ],
      });

      await page.goto(`/generate/cs/${suggestion.id}`);

      // Should complete and redirect to course page
      await page.waitForURL(/\/b\/ai\/c\//, { timeout: 10_000 });
    });
  });

  test.describe("Error handling", () => {
    test("shows error when stream returns error status", async ({ page }) => {
      const suggestion = await courseSuggestionFixture({
        generationStatus: "pending",
        language: "en",
        slug: `e2e-error-${randomUUID().slice(0, 8)}`,
        title: "E2E Error Handling Test",
      });

      await setupMockApis(page, {
        streamMessages: [
          { status: "started", step: "getCourseSuggestion" },
          { reason: "notFound", status: "error", step: "getCourseSuggestion" },
        ],
      });

      await page.goto(`/generate/cs/${suggestion.id}`);

      // Should show error message when a step errors
      await expect(page.getByText(/something went wrong/i)).toBeVisible({
        timeout: 10_000,
      });
    });
  });

  test.describe("Not found", () => {
    test("invalid suggestion ID shows 404 page", async ({ page }) => {
      await page.goto("/generate/cs/999999");
      await expect(page.getByText(/not found|404/i)).toBeVisible();
    });

    test("non-numeric suggestion ID shows 404 page", async ({ page }) => {
      await page.goto("/generate/cs/invalid-id");
      await expect(page.getByText(/not found|404/i)).toBeVisible();
    });
  });
});
