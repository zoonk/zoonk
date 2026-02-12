import { randomUUID } from "node:crypto";
import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { expect, test } from "./fixtures";

async function createTestCourseWithChapters() {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-progress-course-${uniqueId}`,
    title: `E2E Progress Course ${uniqueId}`,
  });

  const [chapter1, chapter2, chapter3] = await Promise.all([
    chapterFixture({
      courseId: course.id,
      description: `Chapter 1 desc ${uniqueId}`,
      isPublished: true,
      organizationId: org.id,
      position: 0,
      slug: `e2e-ch1-${uniqueId}`,
      title: `E2E Chapter One ${uniqueId}`,
    }),
    chapterFixture({
      courseId: course.id,
      description: `Chapter 2 desc ${uniqueId}`,
      isPublished: true,
      organizationId: org.id,
      position: 1,
      slug: `e2e-ch2-${uniqueId}`,
      title: `E2E Chapter Two ${uniqueId}`,
    }),
    chapterFixture({
      courseId: course.id,
      description: `Chapter 3 desc ${uniqueId}`,
      isPublished: true,
      organizationId: org.id,
      position: 2,
      slug: `e2e-ch3-${uniqueId}`,
      title: `E2E Chapter Three ${uniqueId}`,
    }),
  ]);

  return { chapter1, chapter2, chapter3, course };
}

function mockCourseCompletionAPI(
  page: Page,
  chapters: {
    chapterId: number;
    completedLessons: number;
    totalLessons: number;
  }[],
) {
  return page.route("**/v1/progress/course-completion**", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ chapters }),
      contentType: "application/json",
      status: 200,
    });
  });
}

test.describe("Course Progress Indicators", () => {
  test("shows no indicators when API returns empty chapters", async ({ page }) => {
    const { course } = await createTestCourseWithChapters();

    await mockCourseCompletionAPI(page, []);
    await page.goto(`/b/ai/c/${course.slug}`);

    // Verify page loaded
    await expect(page.getByRole("heading", { level: 1, name: course.title })).toBeVisible();

    // No completion indicators should be visible
    await expect(page.getByRole("img", { name: /^completed$/i })).toHaveCount(0);
    await expect(page.getByLabel(/of .+ completed/)).toHaveCount(0);
  });

  test("shows completed checkmarks for chapters with all lessons done", async ({ page }) => {
    const { chapter1, chapter2, chapter3, course } = await createTestCourseWithChapters();

    await mockCourseCompletionAPI(page, [
      { chapterId: chapter1.id, completedLessons: 5, totalLessons: 5 },
      { chapterId: chapter2.id, completedLessons: 3, totalLessons: 3 },
      { chapterId: chapter3.id, completedLessons: 4, totalLessons: 4 },
    ]);

    await page.goto(`/b/ai/c/${course.slug}`);

    await expect(page.getByRole("heading", { level: 1, name: course.title })).toBeVisible();

    const completedIndicators = page.getByRole("img", { name: /^completed$/i });
    await expect(completedIndicators).toHaveCount(3);
  });

  test("shows fraction text for partially completed chapters", async ({ page }) => {
    const { chapter1, chapter2, chapter3, course } = await createTestCourseWithChapters();

    await mockCourseCompletionAPI(page, [
      { chapterId: chapter1.id, completedLessons: 3, totalLessons: 10 },
      { chapterId: chapter2.id, completedLessons: 7, totalLessons: 12 },
      { chapterId: chapter3.id, completedLessons: 1, totalLessons: 5 },
    ]);

    await page.goto(`/b/ai/c/${course.slug}`);

    await expect(page.getByRole("heading", { level: 1, name: course.title })).toBeVisible();

    await expect(page.getByLabel("3 of 10 completed")).toBeVisible();
    await expect(page.getByLabel("7 of 12 completed")).toBeVisible();
    await expect(page.getByLabel("1 of 5 completed")).toBeVisible();
  });

  test("shows mix of completed, in-progress, and not-started states", async ({ page }) => {
    const { chapter1, chapter2, chapter3, course } = await createTestCourseWithChapters();

    await mockCourseCompletionAPI(page, [
      { chapterId: chapter1.id, completedLessons: 5, totalLessons: 5 },
      { chapterId: chapter2.id, completedLessons: 3, totalLessons: 8 },
      { chapterId: chapter3.id, completedLessons: 0, totalLessons: 6 },
    ]);

    await page.goto(`/b/ai/c/${course.slug}`);

    await expect(page.getByRole("heading", { level: 1, name: course.title })).toBeVisible();

    // Chapter 1: fully completed -> checkmark
    const completedIndicators = page.getByRole("img", { name: /^completed$/i });
    await expect(completedIndicators).toHaveCount(1);

    // Chapter 2: partially completed -> fraction
    await expect(page.getByLabel("3 of 8 completed")).toBeVisible();

    // Chapter 3: not started -> nothing shown (0 completed)
  });
});
