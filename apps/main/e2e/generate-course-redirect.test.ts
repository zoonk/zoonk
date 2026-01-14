import { randomUUID } from "node:crypto";
import type { Route } from "@zoonk/e2e/fixtures";
import { courseSuggestionFixture } from "@zoonk/testing/fixtures/course-suggestions";
import { expect, test } from "./fixtures";

const TEST_RUN_ID = "test-run-id-redirect";

/**
 * Mock the workflow APIs to avoid hitting real services.
 * Returns a simple "in progress" state that shows the generation UI.
 */
async function mockWorkflowApis(route: Route) {
  const url = route.request().url();
  const method = route.request().method();

  if (
    url.includes("/api/workflows/course-generation/trigger") &&
    method === "POST"
  ) {
    await route.fulfill({
      body: JSON.stringify({ message: "Workflow started", runId: TEST_RUN_ID }),
      contentType: "application/json",
      status: 200,
    });
    return;
  }

  if (url.includes("/api/workflows/course-generation/status")) {
    // Return a simple in-progress message to show the generation UI
    await route.fulfill({
      body: `data: ${JSON.stringify({ status: "running", step: "getCourseSuggestion" })}\n\n`,
      contentType: "text/event-stream",
      status: 200,
    });
    return;
  }

  await route.continue();
}

test.describe("Generate Course Redirect", () => {
  test("redirects to generate/cs/[id] when course suggestion exists", async ({
    page,
  }) => {
    const slug = `e2e-redirect-${randomUUID().slice(0, 8)}`;
    const suggestion = await courseSuggestionFixture({
      generationStatus: "running",
      language: "en",
      slug,
      title: "E2E Redirect Test",
    });

    // Mock the workflow APIs before navigating
    await page.route("**/api/workflows/**", mockWorkflowApis);

    await page.goto(`/generate/c/${slug}`);

    // Should redirect to /generate/cs/{id}
    await page.waitForURL(`/generate/cs/${suggestion.id}`, { timeout: 10_000 });

    // Verify we're on the generation page by checking for the header
    await expect(page.getByText(/creating your course/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("shows 404 when course suggestion does not exist", async ({ page }) => {
    await page.goto(`/generate/c/nonexistent-${randomUUID()}`);

    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });
});
