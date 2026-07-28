import { randomUUID } from "node:crypto";
import { type Route } from "@zoonk/e2e/fixtures";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { coursePromptFixture } from "@zoonk/testing/fixtures/course-prompts";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { normalizeString } from "@zoonk/utils/string";
import { expect, test } from "./fixtures";
import { isGenerationEvents, isGenerationTrigger, routeGenerationApis } from "./generation-api";

const TEST_RUN_ID = "test-run-id-redirect";

/**
 * Mock the course-generation APIs to avoid hitting real services.
 * Returns a simple "in progress" state that shows the generation UI.
 */
async function mockCourseGenerationApis(route: Route) {
  const url = route.request().url();

  if (isGenerationTrigger({ request: route.request(), targetType: "coursePrompt" })) {
    await route.fulfill({
      body: JSON.stringify({ id: TEST_RUN_ID, status: "pending" }),
      contentType: "application/json",
      status: 202,
    });

    return;
  }

  if (isGenerationEvents(url)) {
    // Return a simple in-progress message to show the generation UI
    await route.fulfill({
      body: `data: ${JSON.stringify({ status: "started", step: "getCoursePrompt" })}\n\n`,
      contentType: "text/event-stream",
      status: 200,
    });

    return;
  }

  await route.continue();
}

test.describe("Generate Course Redirect", () => {
  test("redirects signed-in users to generate/course/[id] when request exists", async ({
    authenticatedPage,
  }) => {
    const slug = `e2e-redirect-${randomUUID().slice(0, 8)}`;
    const org = await getAiOrganization();
    const title = "E2E Redirect Test";

    const course = await courseFixture({
      generationStatus: "running",
      isPublished: true,
      language: "en",
      normalizedTitle: normalizeString(title),
      organizationId: org.id,
      slug,
      title,
    });

    const request = await coursePromptFixture({
      canonicalTitle: title,
      courseId: course.id,
      generationStatus: "running",
      prompt: `Generate ${title} ${slug}`,
    });

    // Mock the generation APIs before navigating
    await routeGenerationApis({ handler: mockCourseGenerationApis, page: authenticatedPage });

    await authenticatedPage.goto(`/generate/c/${slug}`);

    await authenticatedPage.waitForURL(`/generate/course/${request.id}`, { timeout: 10_000 });

    await expect(
      authenticatedPage.getByRole("heading", { name: `Creating the ${title} course` }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("redirects unauthenticated users to generate/course/[id]", async ({ page }) => {
    const slug = `e2e-redirect-unauth-${randomUUID().slice(0, 8)}`;
    const org = await getAiOrganization();
    const title = "E2E Redirect Unauth Test";

    const course = await courseFixture({
      generationStatus: "running",
      isPublished: true,
      language: "en",
      normalizedTitle: normalizeString(title),
      organizationId: org.id,
      slug,
      title,
    });

    const request = await coursePromptFixture({
      canonicalTitle: title,
      courseId: course.id,
      generationStatus: "running",
      prompt: `Generate ${title} ${slug}`,
    });

    await routeGenerationApis({ handler: mockCourseGenerationApis, page });

    await page.goto(`/generate/c/${slug}`);

    await page.waitForURL(`/generate/course/${request.id}`, { timeout: 10_000 });

    await expect(page.getByRole("heading", { name: `Creating the ${title} course` })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("shows 404 when course request does not exist", async ({ authenticatedPage }) => {
    await authenticatedPage.goto(`/generate/c/nonexistent-${randomUUID()}`);

    await expect(authenticatedPage.getByText(/not found|404/iu)).toBeVisible();
  });
});
