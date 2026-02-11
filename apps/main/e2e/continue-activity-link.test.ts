import { randomUUID } from "node:crypto";
import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { expect, test } from "./fixtures";

async function createTestCourseWithActivity() {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-cal-course-${uniqueId}`,
    title: `E2E CAL Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    slug: `e2e-cal-ch-${uniqueId}`,
    title: `E2E CAL Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    slug: `e2e-cal-l-${uniqueId}`,
    title: `E2E CAL Lesson ${uniqueId}`,
  });

  await activityFixture({
    isPublished: true,
    kind: "background",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
    title: `E2E CAL Activity ${uniqueId}`,
  });

  return { chapter, course, lesson, org };
}

function mockNextActivityAPI(
  page: Page,
  response: {
    activityPosition: number;
    brandSlug: string;
    chapterSlug: string;
    completed: boolean;
    courseSlug: string;
    hasStarted: boolean;
    lessonSlug: string;
  },
) {
  return page.route("**/v1/progress/next-activity**", async (route) => {
    await route.fulfill({
      body: JSON.stringify(response),
      contentType: "application/json",
      status: 200,
    });
  });
}

function mockNoActivitiesAPI(page: Page) {
  return page.route("**/v1/progress/next-activity**", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ completed: false, hasStarted: false }),
      contentType: "application/json",
      status: 200,
    });
  });
}

test.describe("Continue Activity Link", () => {
  test("course page shows Start link for unauthenticated user", async ({ page }) => {
    const { chapter, course, lesson } = await createTestCourseWithActivity();

    await mockNextActivityAPI(page, {
      activityPosition: 0,
      brandSlug: "ai",
      chapterSlug: chapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: false,
      lessonSlug: lesson.slug,
    });

    await page.goto(`/b/ai/c/${course.slug}`);

    const startLink = page.getByRole("link", { name: /^start$/i });
    await expect(startLink).toBeVisible();
  });

  test("course page Start link navigates to an activity URL", async ({ page }) => {
    const { chapter, course, lesson } = await createTestCourseWithActivity();

    await mockNextActivityAPI(page, {
      activityPosition: 0,
      brandSlug: "ai",
      chapterSlug: chapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: false,
      lessonSlug: lesson.slug,
    });

    await page.goto(`/b/ai/c/${course.slug}`);

    const startLink = page.getByRole("link", { name: /^start$/i });
    await expect(startLink).toBeVisible();
    await startLink.click();

    await expect(page).toHaveURL(/\/a\/\d+$/);
  });

  test("chapter page shows Start link for unauthenticated user", async ({ page }) => {
    const { chapter, course, lesson } = await createTestCourseWithActivity();

    await mockNextActivityAPI(page, {
      activityPosition: 0,
      brandSlug: "ai",
      chapterSlug: chapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: false,
      lessonSlug: lesson.slug,
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}`);

    const startLink = page.getByRole("link", { name: /^start$/i });
    await expect(startLink).toBeVisible();
  });

  test("lesson page shows Start link for unauthenticated user", async ({ page }) => {
    const { chapter, course, lesson } = await createTestCourseWithActivity();

    await mockNextActivityAPI(page, {
      activityPosition: 0,
      brandSlug: "ai",
      chapterSlug: chapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: false,
      lessonSlug: lesson.slug,
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    const startLink = page.getByRole("link", { name: /^start$/i });
    await expect(startLink).toBeVisible();
  });

  test("course page falls back to first chapter when no activity data", async ({ page }) => {
    const { chapter, course } = await createTestCourseWithActivity();
    await mockNoActivitiesAPI(page);

    await page.goto(`/b/ai/c/${course.slug}`);

    const startLink = page.getByRole("link", { name: /^start$/i });
    await expect(startLink).toBeVisible();
    await expect(startLink).toHaveAttribute(
      "href",
      expect.stringContaining(`/b/ai/c/${course.slug}/ch/${chapter.slug}`),
    );
  });

  test("chapter page falls back to first lesson when no activity data", async ({ page }) => {
    const { chapter, course, lesson } = await createTestCourseWithActivity();
    await mockNoActivitiesAPI(page);

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}`);

    const startLink = page.getByRole("link", { name: /^start$/i });
    await expect(startLink).toBeVisible();
    await expect(startLink).toHaveAttribute(
      "href",
      expect.stringContaining(`/ch/${chapter.slug}/l/${lesson.slug}`),
    );
  });

  test("lesson page falls back to first activity when no activity data", async ({ page }) => {
    const { chapter, course, lesson } = await createTestCourseWithActivity();
    await mockNoActivitiesAPI(page);

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    const startLink = page.getByRole("link", { name: /^start$/i });
    await expect(startLink).toBeVisible();
    await expect(startLink).toHaveAttribute(
      "href",
      expect.stringContaining(`/l/${lesson.slug}/a/0`),
    );
  });

  test("authenticated user with progress sees Continue on course page", async ({
    authenticatedPage,
  }) => {
    const { chapter, course, lesson, org } = await createTestCourseWithActivity();

    await activityFixture({
      isPublished: true,
      kind: "explanation",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 1,
      title: `E2E CAL Activity 2 ${course.slug}`,
    });

    await mockNextActivityAPI(authenticatedPage, {
      activityPosition: 1,
      brandSlug: "ai",
      chapterSlug: chapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: true,
      lessonSlug: lesson.slug,
    });

    await authenticatedPage.goto(`/b/ai/c/${course.slug}`);

    const continueLink = authenticatedPage.getByRole("link", { name: /^continue$/i });
    await expect(continueLink).toBeVisible();
  });
});
