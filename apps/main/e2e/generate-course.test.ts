import type { Page, Route } from "@zoonk/e2e/fixtures";
import { expect, test } from "./fixtures";

/**
 * Test Architecture for Course Generation Page
 *
 * The generation page interacts with 3 APIs:
 * 1. POST /api/workflows/course-generation/trigger - Starts the workflow, returns { runId: string }
 * 2. GET /api/workflows/course-generation/status?runId=X&startIndex=N - Returns NDJSON stream of step updates
 * 3. GET /api/workflows/run-status?runId=X - Polled via SWR, returns { status: "running" | "completed" | "failed" }
 *
 * Client behavior:
 * - Auto-triggers workflow on mount (no idle state)
 * - Shows "Starting generation..." while triggering
 * - Shows current step label + spinner while streaming
 * - Shows completed steps with checkmarks
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
  streamMessages?: Array<{ step: string; status: string }>;
  runStatus?: "running" | "completed" | "failed";
};

/**
 * Creates a mock NDJSON stream response from an array of messages.
 * Each message is JSON stringified and separated by newlines.
 */
function createNDJSONStream(
  messages: Array<{ step: string; status: string }>,
): string {
  return `${messages.map((msg) => JSON.stringify(msg)).join("\n")}\n`;
}

/**
 * Creates the route handler function for mocking APIs.
 * Extracted to reduce complexity in test functions.
 */
function createRouteHandler(options: MockApiOptions) {
  const {
    triggerResponse = { runId: TEST_RUN_ID },
    streamMessages = [],
    runStatus = "running",
  } = options;

  return async (route: Route) => {
    const url = route.request().url();
    const method = route.request().method();

    // Mock trigger API
    if (
      url.includes("/api/workflows/course-generation/trigger") &&
      method === "POST"
    ) {
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
    if (url.includes("/api/workflows/course-generation/status")) {
      await route.fulfill({
        body: createNDJSONStream(streamMessages),
        contentType: "text/plain; charset=utf-8",
        status: 200,
      });
      return;
    }

    // Mock run status polling API
    if (url.includes("/api/workflows/run-status")) {
      await route.fulfill({
        body: JSON.stringify({ status: runStatus }),
        contentType: "application/json",
        status: 200,
      });
      return;
    }

    // Continue with all other requests
    await route.continue();
  };
}

/**
 * Sets up route interception for all course generation APIs.
 * Must be called BEFORE navigation.
 */
async function setupMockApis(
  page: Page,
  options: MockApiOptions = {},
): Promise<void> {
  await page.route("**/*", createRouteHandler(options));
}

/**
 * Gets a valid suggestion ID from the learn page without triggering generation.
 * This is used to get a valid ID before setting up route mocks.
 */
async function getSuggestionId(page: Page): Promise<string> {
  await page.goto("/learn/test%20prompt");
  await expect(
    page.getByRole("heading", { name: /course ideas for/i }),
  ).toBeVisible();

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
async function navigateWithMocks(
  page: Page,
  options: MockApiOptions,
): Promise<void> {
  // First get the suggestion ID without mocks
  const suggestionId = await getSuggestionId(page);

  // Set up route mocking
  await setupMockApis(page, options);

  // Navigate directly to the generate page
  await page.goto(`/generate/cs/${suggestionId}`);
}

test.describe("Generate Course Page", () => {
  test.describe("Initial triggering state", () => {
    test("shows triggering state immediately on page load", async ({
      page,
    }) => {
      // Navigate via suggestions page to get a valid suggestion ID
      await page.goto("/learn/test%20prompt");
      await expect(
        page.getByRole("heading", { name: /course ideas for/i }),
      ).toBeVisible();

      const generateLink = page
        .getByRole("link", { name: /generate/i })
        .first();
      await generateLink.click();

      await expect(page).toHaveURL(/\/generate\/cs\/\d+/);

      // Should immediately show triggering or streaming state (no idle state)
      await expect(
        page.getByText(/starting generation|processing/i),
      ).toBeVisible({
        timeout: 10_000,
      });
    });
  });

  test.describe("Streaming step updates", () => {
    test("displays step labels as workflow progresses through multiple steps", async ({
      page,
    }) => {
      await navigateWithMocks(page, {
        runStatus: "running",
        streamMessages: [
          { status: "started", step: "getCourseSuggestion" },
          { status: "completed", step: "getCourseSuggestion" },
          { status: "started", step: "generateDescription" },
          { status: "completed", step: "generateDescription" },
          { status: "started", step: "generateChapters" },
          { status: "completed", step: "generateChapters" },
        ],
      });

      // Wait for streaming state - should see completed steps with checkmarks
      await expect(page.getByText(/loading course information/i)).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByText(/generating description/i)).toBeVisible();
      await expect(page.getByText(/planning chapters/i)).toBeVisible();
    });

    test("shows current step with spinner while processing", async ({
      page,
    }) => {
      await navigateWithMocks(page, {
        runStatus: "running",
        streamMessages: [
          { status: "started", step: "getCourseSuggestion" },
          { status: "completed", step: "getCourseSuggestion" },
          { status: "started", step: "generateDescription" },
        ],
      });

      // Should show the current step being processed
      const liveRegion = page.locator("[aria-live='polite']");
      await expect(liveRegion).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/generating description/i)).toBeVisible();
    });
  });

  test.describe("Workflow completion and redirect", () => {
    test("shows completion state and redirects to course page", async ({
      page,
    }) => {
      await navigateWithMocks(page, {
        runStatus: "completed",
        streamMessages: [
          { status: "started", step: "getCourseSuggestion" },
          { status: "completed", step: "getCourseSuggestion" },
          { status: "started", step: "finalize" },
          { status: "completed", step: "finalize" },
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
    test("shows error when workflow status is failed", async ({ page }) => {
      await navigateWithMocks(page, {
        runStatus: "failed",
        streamMessages: [
          { status: "started", step: "getCourseSuggestion" },
          { status: "completed", step: "getCourseSuggestion" },
        ],
      });

      // Should show error message after detecting failed status
      await expect(page.getByText(/generation failed/i)).toBeVisible({
        timeout: 10_000,
      });
    });

    test("shows error when stream returns error status", async ({ page }) => {
      await navigateWithMocks(page, {
        runStatus: "running",
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
