import { randomUUID } from "node:crypto";
import { type Page, type Route } from "@zoonk/e2e/fixtures";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
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
 * - Workflow completes when the configured completion step is received
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
  streamMessages?: { entityId?: string; reason?: string; step: string; status: string }[];
  streamError?: boolean;
  statusDelayMs?: number;
};

/**
 * Creates a mock SSE stream response from an array of messages.
 * Each message follows the SSE format: "data: {...}\n\n"
 */
function createSSEStream(
  messages: { entityId?: string; reason?: string; step: string; status: string }[],
): string {
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
        body: JSON.stringify({ message: "Workflow started", runId: triggerResponse.runId }),
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

/**
 * Creates enough course content for completion redirects to land on a real
 * course page. The generation page only checks the URL, but the destination
 * route still needs a published course with playable content.
 */
async function createPublishedCourseWithLesson({
  generationStatus,
  slug,
  title,
}: {
  generationStatus?: "completed" | "running";
  slug: string;
  title: string;
}) {
  const org = await getAiOrganization();

  const course = await courseFixture({
    ...(generationStatus ? { generationStatus } : {}),
    isPublished: true,
    organizationId: org.id,
    slug,
    title,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
  });

  await lessonFixture({ chapterId: chapter.id, isPublished: true, organizationId: org.id });

  return course;
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
      await expect(page.getByText(/creating your course/iu)).toBeVisible({ timeout: 10_000 });

      await expect(page.getByText(/this usually takes about 2 minutes/iu)).toBeVisible();

      const exitLink = page.getByRole("link", { name: /back home/iu });
      await expect(exitLink).toBeVisible();
      await expect(exitLink).toHaveAttribute("href", "/");
    });
  });

  test.describe("Workflow completion and redirect", () => {
    test("redirects to linked completed course without starting generation", async ({ page }) => {
      const sourceSlug = `e2e-linked-source-${randomUUID().slice(0, 8)}`;
      const courseSlug = `e2e-linked-course-${randomUUID().slice(0, 8)}`;

      const course = await createPublishedCourseWithLesson({
        generationStatus: "completed",
        slug: courseSlug,
        title: "E2E Linked Completed Course",
      });

      const suggestion = await courseSuggestionFixture({
        courseId: course.id,
        generationStatus: "pending",
        language: "en",
        slug: sourceSlug,
        title: "E2E Linked Completed Suggestion",
      });

      await page.route("**/v1/workflows/course-generation/**", async (route) => {
        throw new Error(`Generation workflow should not start: ${route.request().url()}`);
      });

      await page.goto(`/generate/cs/${suggestion.id}`);

      await page.waitForURL(new RegExp(`/b/ai/c/${courseSlug}`, "u"), { timeout: 10_000 });
    });

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

      await lessonFixture({ chapterId: chapter.id, isPublished: true, organizationId: org.id });

      await setupMockApis(page, {
        streamMessages: [
          { status: "started", step: "getCourseSuggestion" },
          { status: "completed", step: "getCourseSuggestion" },
          { status: "started", step: "completeCourseSetup" },
          { status: "completed", step: "completeCourseSetup" },
        ],
      });

      await page.goto(`/generate/cs/${suggestion.id}`);

      // Should complete and redirect to course page
      await page.waitForURL(/\/b\/ai\/c\//u, { timeout: 10_000 });
    });

    test("redirects to the completed workflow course slug", async ({ page }) => {
      const sourceSlug = `e2e-identity-source-${randomUUID().slice(0, 8)}`;
      const courseSlug = `e2e-identity-course-${randomUUID().slice(0, 8)}`;

      const suggestion = await courseSuggestionFixture({
        generationStatus: "pending",
        language: "en",
        slug: sourceSlug,
        title: "E2E Identity Redirect Suggestion",
      });

      await createPublishedCourseWithLesson({
        slug: courseSlug,
        title: "E2E Identity Redirect Course",
      });

      await setupMockApis(page, {
        streamMessages: [
          { status: "started", step: "getCourseSuggestion" },
          { status: "completed", step: "getCourseSuggestion" },
          { status: "started", step: "completeCourseSetup" },
          { entityId: courseSlug, status: "completed", step: "completeCourseSetup" },
        ],
      });

      await page.goto(`/generate/cs/${suggestion.id}`);

      await page.waitForURL(new RegExp(`/b/ai/c/${courseSlug}`, "u"), { timeout: 10_000 });
      expect(page.url()).not.toContain(sourceSlug);
    });

    test("redirects to suffixed slug for non-English courses", async ({ page }) => {
      const slug = `e2e-locale-${randomUUID().slice(0, 8)}`;
      const suffixedSlug = `${slug}-pt`;
      const org = await getAiOrganization();

      const [suggestion] = await Promise.all([
        courseSuggestionFixture({
          generationStatus: "pending",
          language: "pt",
          slug,
          title: "E2E Locale Redirect Test",
        }),
        // Use generationStatus "running" so the server-side redirect is skipped
        // and the client-side redirect (the one we're testing) fires instead.
        courseFixture({
          generationStatus: "running",
          isPublished: true,
          organizationId: org.id,
          slug: suffixedSlug,
          title: "E2E Locale Redirect Test",
        }).then(async (course) => {
          const chapter = await chapterFixture({
            courseId: course.id,
            isPublished: true,
            organizationId: org.id,
          });

          await lessonFixture({ chapterId: chapter.id, isPublished: true, organizationId: org.id });
        }),
      ]);

      await setupMockApis(page, {
        streamMessages: [
          { status: "started", step: "getCourseSuggestion" },
          { status: "completed", step: "getCourseSuggestion" },
          { status: "started", step: "completeCourseSetup" },
          { status: "completed", step: "completeCourseSetup" },
        ],
      });

      await page.goto(`/generate/cs/${suggestion.id}`);

      // Should redirect to the suffixed slug, not the raw suggestion slug
      await page.waitForURL(new RegExp(`/b/ai/c/${suffixedSlug}`, "u"), { timeout: 10_000 });
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
      await expect(page.getByText(/something went wrong/iu)).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe("Not found", () => {
    test("invalid suggestion ID shows 404 page", async ({ page }) => {
      await page.goto("/generate/cs/999999");
      await expect(page.getByText(/not found|404/iu)).toBeVisible();
    });

    test("non-numeric suggestion ID shows 404 page", async ({ page }) => {
      await page.goto("/generate/cs/invalid-id");
      await expect(page.getByText(/not found|404/iu)).toBeVisible();
    });
  });
});
