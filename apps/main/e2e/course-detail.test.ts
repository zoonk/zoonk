import { randomUUID } from "node:crypto";
import { type Route } from "@playwright/test";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseSuggestionFixture } from "@zoonk/testing/fixtures/course-suggestions";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { normalizeString } from "@zoonk/utils/string";
import { expect, test } from "./fixtures";

const TEST_RUN_ID = "test-run-id-course-detail";
const UUID_SHORT_LENGTH = 8;

/**
 * Mock the workflow APIs to avoid hitting real services.
 */
async function mockWorkflowApis(route: Route) {
  const url = route.request().url();
  const method = route.request().method();

  if (url.includes("/api/workflows/course-generation/trigger") && method === "POST") {
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

const testData: {
  courseNoImageTitle: string;
  courseNoImageUrl: string;
  courseWithImageDescription: string;
  courseWithImageTitle: string;
  courseWithImageUrl: string;
  ptCourseUrl: string;
} = {
  courseNoImageTitle: "",
  courseNoImageUrl: "",
  courseWithImageDescription: "",
  courseWithImageTitle: "",
  courseWithImageUrl: "",
  ptCourseUrl: "",
};

test.beforeAll(async () => {
  const uniqueId = randomUUID().slice(0, UUID_SHORT_LENGTH);
  const org = await getAiOrganization();

  testData.courseWithImageTitle = `E2E Image Course ${uniqueId}`;
  testData.courseWithImageDescription = `Description for image course ${uniqueId}`;
  testData.courseNoImageTitle = `E2E No Image Course ${uniqueId}`;
  const ptCourseTitle = `E2E Curso PT ${uniqueId}`;

  const [courseWithImage, courseNoImage, ptCourse] = await Promise.all([
    courseFixture({
      description: testData.courseWithImageDescription,
      imageUrl: "https://placehold.co/200x200.png",
      isPublished: true,
      language: "en",
      normalizedTitle: normalizeString(testData.courseWithImageTitle),
      organizationId: org.id,
      slug: `e2e-img-course-${uniqueId}`,
      title: testData.courseWithImageTitle,
    }),
    courseFixture({
      isPublished: true,
      language: "en",
      normalizedTitle: normalizeString(testData.courseNoImageTitle),
      organizationId: org.id,
      slug: `e2e-noimg-course-${uniqueId}`,
      title: testData.courseNoImageTitle,
    }),
    courseFixture({
      isPublished: true,
      language: "pt",
      normalizedTitle: normalizeString(ptCourseTitle),
      organizationId: org.id,
      slug: `e2e-pt-course-${uniqueId}`,
      title: ptCourseTitle,
    }),
  ]);

  // Courses need at least one chapter to avoid the generate redirect
  await Promise.all([
    chapterFixture({
      courseId: courseWithImage.id,
      isPublished: true,
      organizationId: org.id,
      position: 0,
      slug: `e2e-img-ch-${uniqueId}`,
      title: `Image Course Chapter ${uniqueId}`,
    }),
    chapterFixture({
      courseId: courseNoImage.id,
      isPublished: true,
      organizationId: org.id,
      position: 0,
      slug: `e2e-noimg-ch-${uniqueId}`,
      title: `No Image Course Chapter ${uniqueId}`,
    }),
    chapterFixture({
      courseId: ptCourse.id,
      isPublished: true,
      language: "pt",
      organizationId: org.id,
      position: 0,
      slug: `e2e-pt-ch-${uniqueId}`,
      title: `Capítulo PT ${uniqueId}`,
    }),
  ]);

  testData.courseWithImageUrl = `/b/${AI_ORG_SLUG}/c/${courseWithImage.slug}`;
  testData.courseNoImageUrl = `/b/${AI_ORG_SLUG}/c/${courseNoImage.slug}`;
  testData.ptCourseUrl = `/pt/b/${AI_ORG_SLUG}/c/${ptCourse.slug}`;
});

test.describe("Course Detail Page", () => {
  test("shows course content with title, description, and image", async ({ page }) => {
    await page.goto(testData.courseWithImageUrl);

    await expect(
      page.getByRole("heading", { level: 1, name: testData.courseWithImageTitle }),
    ).toBeVisible();

    await expect(page.getByText(testData.courseWithImageDescription).first()).toBeVisible();

    const courseImage = page.getByRole("img", { name: testData.courseWithImageTitle });
    await expect(courseImage).toBeVisible();
  });

  test("non-existent course shows 404 page", async ({ page }) => {
    await page.goto(`/b/${AI_ORG_SLUG}/c/nonexistent-course`);

    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });

  test("redirects to generate page when course has no chapters", async ({ page }) => {
    const org = await getAiOrganization();

    const slug = `e2e-no-chapters-${randomUUID().slice(0, UUID_SHORT_LENGTH)}`;

    const [, suggestion] = await Promise.all([
      courseFixture({
        generationStatus: "running",
        isPublished: true,
        language: "en",
        organizationId: org.id,
        slug,
        title: "E2E No Chapters Course",
      }),
      courseSuggestionFixture({
        generationStatus: "running",
        language: "en",
        slug,
        title: "E2E No Chapters Course",
      }),
    ]);

    await page.route("**/api/workflows/**", mockWorkflowApis);

    await page.goto(`/b/${AI_ORG_SLUG}/c/${slug}`);

    await page.waitForURL(`/generate/cs/${suggestion.id}`, { timeout: 10_000 });

    await expect(page.getByText(/creating your course/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("shows fallback icon when course has no image", async ({ page }) => {
    await page.goto(testData.courseNoImageUrl);

    await expect(page.getByRole("heading", { name: testData.courseNoImageTitle })).toBeVisible();

    const fallbackIcon = page.getByRole("img", { name: testData.courseNoImageTitle }).first();
    await expect(fallbackIcon).toBeVisible();
    await expect(fallbackIcon).not.toHaveAttribute("src");
  });
});

test.describe("Course Detail Page - Locale", () => {
  test("clicking course from PT list preserves locale", async ({ page }) => {
    await page.goto(testData.ptCourseUrl);

    await expect(page).toHaveURL(/\/pt\/b\/ai\/c\//);
  });
});
