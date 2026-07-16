import { randomUUID } from "node:crypto";
import { type Route } from "@playwright/test";
import { setLocale } from "@zoonk/e2e/fixtures/locale";
import { createOrganization, getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { coursePromptFixture } from "@zoonk/testing/fixtures/course-prompts";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
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

  if (url.includes("/v1/workflows/course-generation/trigger") && method === "POST") {
    await route.fulfill({
      body: JSON.stringify({ message: "Workflow started", runId: TEST_RUN_ID }),
      contentType: "application/json",
      status: 200,
    });

    return;
  }

  if (url.includes("/v1/workflows/course-generation/status")) {
    await route.fulfill({
      body: `data: ${JSON.stringify({ status: "running", step: "getCoursePrompt" })}\n\n`,
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
  regionalCourseTitle: string;
  regionalCourseUrl: string;
} = {
  courseNoImageTitle: "",
  courseNoImageUrl: "",
  courseWithImageDescription: "",
  courseWithImageTitle: "",
  courseWithImageUrl: "",
  ptCourseUrl: "",
  regionalCourseTitle: "",
  regionalCourseUrl: "",
};

test.beforeAll(async () => {
  const uniqueId = randomUUID().slice(0, UUID_SHORT_LENGTH);
  const org = await getAiOrganization();

  testData.courseWithImageTitle = `E2E Image Course ${uniqueId}`;
  testData.courseWithImageDescription = `Description for image course ${uniqueId}`;
  testData.courseNoImageTitle = `E2E No Image Course ${uniqueId}`;
  const ptCourseTitle = `E2E Curso PT ${uniqueId}`;
  testData.regionalCourseTitle = `E2E Regional Course ${uniqueId}`;

  const [courseWithImage, courseNoImage, ptCourse, regionalCourse] = await Promise.all([
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
    courseFixture({
      isPublished: true,
      language: "pt-BR",
      normalizedTitle: normalizeString(testData.regionalCourseTitle),
      organizationId: org.id,
      slug: `e2e-regional-course-${uniqueId}`,
      title: testData.regionalCourseTitle,
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
    chapterFixture({
      courseId: regionalCourse.id,
      isPublished: true,
      language: "pt-BR",
      organizationId: org.id,
      position: 0,
      slug: `e2e-regional-ch-${uniqueId}`,
      title: `Regional Chapter ${uniqueId}`,
    }),
  ]);

  testData.courseWithImageUrl = `/b/${AI_ORG_SLUG}/c/${courseWithImage.slug}`;
  testData.courseNoImageUrl = `/b/${AI_ORG_SLUG}/c/${courseNoImage.slug}`;
  testData.ptCourseUrl = `/b/${AI_ORG_SLUG}/c/${ptCourse.slug}`;
  testData.regionalCourseUrl = `/b/${AI_ORG_SLUG}/c/${regionalCourse.slug}`;
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

  test("non-existent course invites the learner to create it", async ({ page }) => {
    await page.goto(`/b/${AI_ORG_SLUG}/c/nonexistent-course`);

    await expect(
      page.getByRole("heading", { name: "You found a course that hasn't been written yet" }),
    ).toBeVisible();

    await expect(
      page.getByRole("img", { name: "An open book becoming a learning path" }),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "Create this course" })).toHaveAttribute(
      "href",
      "/start/learn",
    );
  });

  test("redirects to generate page when course has no chapters", async ({ authenticatedPage }) => {
    const org = await getAiOrganization();

    const slug = `e2e-no-chapters-${randomUUID().slice(0, UUID_SHORT_LENGTH)}`;

    const title = "E2E No Chapters Course";

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

    await authenticatedPage.route("**/v1/workflows/**", mockWorkflowApis);

    await authenticatedPage.goto(`/b/${AI_ORG_SLUG}/c/${slug}`);

    await authenticatedPage.waitForURL(`/generate/course/${request.id}`, { timeout: 10_000 });

    await expect(
      authenticatedPage.getByRole("heading", { name: `Creating the ${title} course` }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("non-AI courses with no chapters stay on the course page", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, UUID_SHORT_LENGTH);
    const org = await createOrganization();

    const course = await courseFixture({
      isPublished: true,
      language: "en",
      normalizedTitle: normalizeString(`Non AI Empty Course ${uniqueId}`),
      organizationId: org.id,
      slug: `non-ai-empty-course-${uniqueId}`,
      title: `Non AI Empty Course ${uniqueId}`,
    });

    const url = `/b/${org.slug}/c/${course.slug}`;

    await page.goto(url);

    await expect(page).toHaveURL(url);

    await expect(
      page.getByRole("heading", { level: 1, name: `Non AI Empty Course ${uniqueId}` }),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: /^start$/iu })).not.toBeVisible();
  });

  test("shows fallback icon when course has no image", async ({ page }) => {
    await page.goto(testData.courseNoImageUrl);

    await expect(page.getByRole("heading", { name: testData.courseNoImageTitle })).toBeVisible();

    const fallbackIcon = page.getByRole("img", { name: testData.courseNoImageTitle }).first();
    await expect(fallbackIcon).toBeVisible();
    await expect(fallbackIcon).not.toHaveAttribute("src");
  });

  test("renders metadata for a course with a regional language tag", async ({ page }) => {
    await page.goto(testData.regionalCourseUrl);

    await expect(
      page.getByRole("heading", { level: 1, name: testData.regionalCourseTitle }),
    ).toBeVisible();

    await expect(page).toHaveTitle(`Learn ${testData.regionalCourseTitle} | Zoonk`);
  });
});

test.describe("Course Detail Page - Locale", () => {
  test("course page renders in Portuguese locale", async ({ page }) => {
    await setLocale(page, "pt");
    await page.goto(testData.ptCourseUrl);

    await expect(page).toHaveURL(new RegExp(`/b/${AI_ORG_SLUG}/c/`, "u"));
  });
});
