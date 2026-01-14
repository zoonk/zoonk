import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import type { Route } from "@zoonk/e2e/fixtures";
import { courseSuggestionFixture } from "@zoonk/testing/fixtures/course-suggestions";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { expect, test } from "./fixtures";

const TEST_RUN_ID = "test-run-id-course-detail";

/**
 * Mock the workflow APIs to avoid hitting real services.
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
    await route.fulfill({
      body: `data: ${JSON.stringify({ status: "running", step: "getCourseSuggestion" })}\n\n`,
      contentType: "text/event-stream",
      status: 200,
    });
    return;
  }

  await route.continue();
}

test.describe("Course Detail Page", () => {
  test("shows course content with title, description, and image", async ({
    page,
  }) => {
    await page.goto("/b/ai/c/machine-learning");

    await expect(
      page.getByRole("heading", { level: 1, name: /machine learning/i }),
    ).toBeVisible();

    // Use .first() since chapter descriptions may also contain matching words
    await expect(
      page.getByText(/patterns|predictions|data/i).first(),
    ).toBeVisible();

    const courseImage = page.getByRole("img", { name: /machine learning/i });
    await expect(courseImage).toBeVisible();
  });

  test("non-existent course shows 404 page", async ({ page }) => {
    await page.goto("/b/ai/c/nonexistent-course");

    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });

  test("redirects to generate page when course has no chapters", async ({
    page,
  }) => {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { slug: "ai" },
    });

    const slug = `e2e-no-chapters-${randomUUID().slice(0, 8)}`;

    // Create a course with no chapters
    await courseFixture({
      generationStatus: "running",
      isPublished: true,
      language: "en",
      organizationId: org.id,
      slug,
      title: "E2E No Chapters Course",
    });

    // Create a matching CourseSuggestion for the redirect to work
    const suggestion = await courseSuggestionFixture({
      generationStatus: "running",
      language: "en",
      slug,
      title: "E2E No Chapters Course",
    });

    // Mock the workflow APIs before navigating
    await page.route("**/api/workflows/**", mockWorkflowApis);

    await page.goto(`/b/ai/c/${slug}`);

    // First redirects to /generate/c/{slug}, then to /generate/cs/{id}
    await page.waitForURL(`/generate/cs/${suggestion.id}`, { timeout: 10_000 });

    // Verify we're on the generation page
    await expect(page.getByText(/creating your course/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("shows fallback icon when course has no image", async ({ page }) => {
    await page.goto("/b/ai/c/python-programming");

    await expect(
      page.getByRole("heading", { name: /python programming/i }),
    ).toBeVisible();

    // Fallback icon should have role="img" with the course title as aria-label
    // This distinguishes it from actual images which use <img> elements
    const fallbackIcon = page
      .getByRole("img", { name: /python programming/i })
      .first();
    await expect(fallbackIcon).toBeVisible();
    await expect(fallbackIcon).not.toHaveAttribute("src");
  });
});

test.describe("Course Detail Page - Locale", () => {
  test("navigating from Portuguese courses page preserves locale", async ({
    page,
  }) => {
    await page.goto("/pt/courses");

    const courseLink = page.getByRole("link", { name: /^Machine Learning/ });
    await expect(courseLink).toBeVisible();
    await courseLink.click();

    await expect(page).toHaveURL(/\/pt\/b\/ai\/c\/machine-learning/);

    await expect(
      page.getByText(/permite que computadores identifiquem/i).first(),
    ).toBeVisible();
  });
});
