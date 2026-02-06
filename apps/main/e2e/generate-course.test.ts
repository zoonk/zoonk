import { randomUUID } from "node:crypto";
import { type Page, type Route } from "@zoonk/e2e/fixtures";
import { courseSuggestionFixture } from "@zoonk/testing/fixtures/course-suggestions";
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
  streamMessages?: { step: string; status: string }[];
  streamError?: boolean;
};

/**
 * Creates a mock SSE stream response from an array of messages.
 * Each message follows the SSE format: "data: {...}\n\n"
 */
function createSSEStream(messages: { step: string; status: string }[]): string {
  return messages.map((msg) => `data: ${JSON.stringify(msg)}\n\n`).join("");
}

/**
 * Creates the route handler function for mocking APIs.
 * Extracted to reduce complexity in test functions.
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

/**
 * Gets a valid suggestion ID from the learn page without triggering generation.
 * This is used to get a valid ID before setting up route mocks.
 */
async function getSuggestionId(page: Page): Promise<string> {
  await page.goto("/learn/test%20prompt");
  await expect(page.getByRole("heading", { name: /course ideas for/i })).toBeVisible();

  const generateLink = page.getByRole("link", { name: /generate/i }).first();
  const href = await generateLink.getAttribute("href");
  const match = href?.match(/\/generate\/cs\/(\d+)/);
  const suggestionId = match?.[1];

  if (!suggestionId) {
    throw new Error("Could not extract suggestion ID from generate link");
  }

  return suggestionId;
}

/**
 * Gets a suggestion ID and then sets up mocks before navigating directly to the page.
 * This ensures route interception works properly for all API calls.
 */
async function navigateWithMocks(page: Page, options: MockApiOptions): Promise<void> {
  // First get the suggestion ID without mocks
  const suggestionId = await getSuggestionId(page);

  // Set up route mocking
  await setupMockApis(page, options);

  // Navigate directly to the generate page
  await page.goto(`/generate/cs/${suggestionId}`);
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
    });
  });

  test.describe("Workflow completion and redirect", () => {
    test("shows completion state and redirects to course page", async ({ page }) => {
      await navigateWithMocks(page, {
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

      // Should show completion message
      await expect(page.getByText(/course generated/i)).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByText(/redirecting to your course/i)).toBeVisible();

      // Should redirect to course page
      await page.waitForURL(/\/b\/ai\/c\//, { timeout: 10_000 });
    });
  });

  test.describe("Error handling", () => {
    test("shows error when stream returns error status", async ({ page }) => {
      await navigateWithMocks(page, {
        streamMessages: [
          { status: "started", step: "getCourseSuggestion" },
          { status: "error", step: "getCourseSuggestion" },
        ],
      });

      // Should show error message when a step errors
      await expect(page.getByText(/generation failed/i)).toBeVisible({
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
