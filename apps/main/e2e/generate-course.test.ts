import { randomUUID } from "node:crypto";
import { type Page, type Route } from "@zoonk/e2e/fixtures";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseStartRequestFixture } from "@zoonk/testing/fixtures/course-start-requests";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { ensureLocaleSuffix, toSlug } from "@zoonk/utils/string";
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
  assertBearerAuth?: boolean;
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
 * Confirms authenticated workflow calls use the API's bearer-token contract
 * instead of depending on cross-origin cookies that do not work in previews
 * and custom-domain environments.
 */
function expectBearerAuthorization(route: Route): void {
  expect(route.request().headers().authorization).toMatch(/^Bearer .+/u);
}

/**
 * Creates the route handler function for mocking APIs.
 * Extracted to reduce complexity in test functions.
 */
function createRouteHandler(options: MockApiOptions) {
  const {
    assertBearerAuth = false,
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
      if (assertBearerAuth) {
        expectBearerAuthorization(route);
      }

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
      if (assertBearerAuth) {
        expectBearerAuthorization(route);
      }

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
  test("starts course generation for unauthenticated users", async ({ page }) => {
    const request = await courseStartRequestFixture({
      canonicalTitle: "E2E Unauth Course Generation",
      generationStatus: "pending",
      language: "en",
    });

    await setupMockApis(page, {
      statusDelayMs: 2500,
      streamMessages: [{ status: "started", step: "getCourseStartRequest" }],
    });

    await page.goto(`/generate/course/${request.id}`);

    await expect(page.getByText(/creating your course/iu)).toBeVisible({ timeout: 10_000 });
  });

  test.describe("Initial triggering state", () => {
    test("shows triggering state immediately on page load", async ({ authenticatedPage }) => {
      // Create a unique request to avoid PPR caching issues with seeded data
      const request = await courseStartRequestFixture({
        canonicalTitle: "E2E Triggering Test",
        generationStatus: "running",
        language: "en",
      });

      // Set up route mocking before navigation
      await setupMockApis(authenticatedPage, {
        streamMessages: [{ status: "started", step: "getCourseStartRequest" }],
      });

      // Navigate directly to the generate page with the unique request
      await authenticatedPage.goto(`/generate/course/${request.id}`);

      // Should show triggering or streaming state (no idle state)
      await expect(authenticatedPage.getByText(/creating your course/iu)).toBeVisible({
        timeout: 10_000,
      });

      await expect(
        authenticatedPage.getByText(/this usually takes about 2 minutes/iu),
      ).toBeVisible();

      const exitLink = authenticatedPage.getByRole("link", { name: /back home/iu });
      await expect(exitLink).toBeVisible();
      await expect(exitLink).toHaveAttribute("href", "/");
    });
  });

  test.describe("Workflow completion and redirect", () => {
    test("redirects to linked completed course without starting generation", async ({
      authenticatedPage,
    }) => {
      const courseSlug = `e2e-linked-course-${randomUUID().slice(0, 8)}`;

      const course = await createPublishedCourseWithLesson({
        generationStatus: "completed",
        slug: courseSlug,
        title: "E2E Linked Completed Course",
      });

      const request = await courseStartRequestFixture({
        canonicalTitle: "E2E Linked Completed Request",
        courseId: course.id,
        generationStatus: "pending",
        language: "en",
      });

      await authenticatedPage.route("**/v1/workflows/course-generation/**", async (route) => {
        throw new Error(`Generation workflow should not start: ${route.request().url()}`);
      });

      await authenticatedPage.goto(`/generate/course/${request.id}`);

      await authenticatedPage.waitForURL(new RegExp(`/b/ai/c/${courseSlug}`, "u"), {
        timeout: 10_000,
      });
    });

    test("shows completion state and redirects to course page", async ({ authenticatedPage }) => {
      const org = await getAiOrganization();
      const title = "E2E Completion Test";
      const slug = `e2e-completion-${randomUUID().slice(0, 8)}`;

      const request = await courseStartRequestFixture({
        canonicalTitle: title,
        generationStatus: "pending",
        language: "en",
      });

      // Create a real course so the redirect after "completion" works
      const course = await courseFixture({
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

      await setupMockApis(authenticatedPage, {
        assertBearerAuth: true,
        streamMessages: [
          { status: "started", step: "getCourseStartRequest" },
          { status: "completed", step: "getCourseStartRequest" },
          { status: "started", step: "completeCourseSetup" },
          { status: "completed", step: "completeCourseSetup" },
        ],
      });

      await authenticatedPage.goto(`/generate/course/${request.id}`);

      // Should complete and redirect to course page
      await authenticatedPage.waitForURL(/\/b\/ai\/c\//u, { timeout: 10_000 });
    });

    test("redirects to the completed workflow course slug", async ({ authenticatedPage }) => {
      const courseSlug = `e2e-identity-course-${randomUUID().slice(0, 8)}`;

      const request = await courseStartRequestFixture({
        canonicalTitle: "E2E Identity Redirect Request",
        generationStatus: "pending",
        language: "en",
      });

      await createPublishedCourseWithLesson({
        slug: courseSlug,
        title: "E2E Identity Redirect Course",
      });

      await setupMockApis(authenticatedPage, {
        streamMessages: [
          { status: "started", step: "getCourseStartRequest" },
          { status: "completed", step: "getCourseStartRequest" },
          { status: "started", step: "completeCourseSetup" },
          { entityId: courseSlug, status: "completed", step: "completeCourseSetup" },
        ],
      });

      await authenticatedPage.goto(`/generate/course/${request.id}`);

      await authenticatedPage.waitForURL(new RegExp(`/b/ai/c/${courseSlug}`, "u"), {
        timeout: 10_000,
      });

      expect(authenticatedPage.url()).not.toContain(request.id);
    });

    test("redirects to suffixed slug for non-English courses", async ({ authenticatedPage }) => {
      const title = `E2E Locale Redirect ${randomUUID().slice(0, 8)}`;
      const suffixedSlug = ensureLocaleSuffix(toSlug(title), "pt");
      const org = await getAiOrganization();

      const [request] = await Promise.all([
        courseStartRequestFixture({
          canonicalTitle: title,
          generationStatus: "pending",
          language: "pt",
        }),
        // Use generationStatus "running" so the server-side redirect is skipped
        // and the client-side redirect (the one we're testing) fires instead.
        courseFixture({
          generationStatus: "running",
          isPublished: true,
          organizationId: org.id,
          slug: suffixedSlug,
          title,
        }).then(async (course) => {
          const chapter = await chapterFixture({
            courseId: course.id,
            isPublished: true,
            organizationId: org.id,
          });

          await lessonFixture({ chapterId: chapter.id, isPublished: true, organizationId: org.id });
        }),
      ]);

      await setupMockApis(authenticatedPage, {
        streamMessages: [
          { status: "started", step: "getCourseStartRequest" },
          { status: "completed", step: "getCourseStartRequest" },
          { status: "started", step: "completeCourseSetup" },
          { status: "completed", step: "completeCourseSetup" },
        ],
      });

      await authenticatedPage.goto(`/generate/course/${request.id}`);

      // Should redirect to the suffixed slug, not the raw canonical slug.
      await authenticatedPage.waitForURL(new RegExp(`/b/ai/c/${suffixedSlug}`, "u"), {
        timeout: 10_000,
      });
    });
  });

  test.describe("Error handling", () => {
    test("shows error when stream returns error status", async ({ authenticatedPage }) => {
      const request = await courseStartRequestFixture({
        canonicalTitle: "E2E Error Handling Test",
        generationStatus: "pending",
        language: "en",
      });

      await setupMockApis(authenticatedPage, {
        streamMessages: [
          { status: "started", step: "getCourseStartRequest" },
          { reason: "notFound", status: "error", step: "getCourseStartRequest" },
        ],
      });

      await authenticatedPage.goto(`/generate/course/${request.id}`);

      // Should show error message when a step errors
      await expect(authenticatedPage.getByText(/something went wrong/iu)).toBeVisible({
        timeout: 10_000,
      });
    });
  });

  test.describe("Not found", () => {
    test("unknown request ID shows 404 page", async ({ authenticatedPage }) => {
      await authenticatedPage.goto(`/generate/course/${randomUUID()}`);
      await expect(authenticatedPage.getByText(/not found|404/iu)).toBeVisible();
    });

    test("invalid request ID shows 404 page", async ({ authenticatedPage }) => {
      await authenticatedPage.goto("/generate/course/invalid-id");
      await expect(authenticatedPage.getByText(/not found|404/iu)).toBeVisible();
    });
  });
});
