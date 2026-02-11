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
    slug: `e2e-ca-course-${uniqueId}`,
    title: `E2E CA Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    slug: `e2e-ca-ch-${uniqueId}`,
    title: `E2E CA Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    slug: `e2e-ca-l-${uniqueId}`,
    title: `E2E CA Lesson ${uniqueId}`,
  });

  await activityFixture({
    isPublished: true,
    kind: "background",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
    title: `E2E CA Activity ${uniqueId}`,
  });

  return { chapter, course, lesson };
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

test.describe("Catalog Actions", () => {
  test("course page shows actions button", async ({ page }) => {
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

    await expect(page.getByRole("button", { name: /more options/i })).toBeVisible();
  });

  test("dropdown opens with feedback item", async ({ page }) => {
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

    await page.getByRole("button", { name: /more options/i }).click();
    await expect(page.getByRole("button", { name: /send feedback/i })).toBeVisible();
  });

  test("feedback dialog opens from dropdown", async ({ page }) => {
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

    await page.getByRole("button", { name: /more options/i }).click();
    await page.getByRole("button", { name: /send feedback/i }).click();

    await expect(page.getByRole("heading", { name: /feedback/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /message/i })).toBeVisible();
  });

  test("chapter page has actions button", async ({ page }) => {
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

    await expect(page.getByRole("button", { name: /more options/i })).toBeVisible();
  });

  test("lesson page has actions button", async ({ page }) => {
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

    await expect(page.getByRole("button", { name: /more options/i })).toBeVisible();
  });
});
