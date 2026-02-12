import { randomUUID } from "node:crypto";
import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { expect, test } from "./fixtures";

async function createTestChapterWithLessons() {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-chprog-course-${uniqueId}`,
    title: `E2E ChProg Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    description: `Chapter desc ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    slug: `e2e-chprog-ch-${uniqueId}`,
    title: `E2E ChProg Chapter ${uniqueId}`,
  });

  const [lesson1, lesson2, lesson3] = await Promise.all([
    lessonFixture({
      chapterId: chapter.id,
      description: `Lesson 1 desc ${uniqueId}`,
      isPublished: true,
      organizationId: org.id,
      position: 0,
      slug: `e2e-l1-${uniqueId}`,
      title: `E2E Lesson One ${uniqueId}`,
    }),
    lessonFixture({
      chapterId: chapter.id,
      description: `Lesson 2 desc ${uniqueId}`,
      isPublished: true,
      organizationId: org.id,
      position: 1,
      slug: `e2e-l2-${uniqueId}`,
      title: `E2E Lesson Two ${uniqueId}`,
    }),
    lessonFixture({
      chapterId: chapter.id,
      description: `Lesson 3 desc ${uniqueId}`,
      isPublished: true,
      organizationId: org.id,
      position: 2,
      slug: `e2e-l3-${uniqueId}`,
      title: `E2E Lesson Three ${uniqueId}`,
    }),
  ]);

  return { chapter, course, lesson1, lesson2, lesson3 };
}

function mockChapterCompletionAPI(
  page: Page,
  lessons: {
    completedActivities: number;
    lessonId: number;
    totalActivities: number;
  }[],
) {
  return page.route("**/v1/progress/chapter-completion**", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ lessons }),
      contentType: "application/json",
      status: 200,
    });
  });
}

test.describe("Chapter Progress Indicators", () => {
  test("shows no indicators when API returns empty lessons", async ({ page }) => {
    const { chapter, course } = await createTestChapterWithLessons();

    await mockChapterCompletionAPI(page, []);
    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}`);

    await expect(page.getByRole("heading", { level: 1, name: chapter.title })).toBeVisible();

    await expect(page.getByRole("img", { name: /^completed$/i })).toHaveCount(0);
    await expect(page.getByLabel(/of .+ completed/)).toHaveCount(0);
  });

  test("shows completed checkmarks for lessons with all activities done", async ({ page }) => {
    const { chapter, course, lesson1, lesson2, lesson3 } = await createTestChapterWithLessons();

    await mockChapterCompletionAPI(page, [
      { completedActivities: 4, lessonId: lesson1.id, totalActivities: 4 },
      { completedActivities: 3, lessonId: lesson2.id, totalActivities: 3 },
      { completedActivities: 5, lessonId: lesson3.id, totalActivities: 5 },
    ]);

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}`);

    await expect(page.getByRole("heading", { level: 1, name: chapter.title })).toBeVisible();

    const completedIndicators = page.getByRole("img", { name: /^completed$/i });
    await expect(completedIndicators).toHaveCount(3);
  });

  test("shows fraction text for partially completed lessons", async ({ page }) => {
    const { chapter, course, lesson1, lesson2, lesson3 } = await createTestChapterWithLessons();

    await mockChapterCompletionAPI(page, [
      { completedActivities: 2, lessonId: lesson1.id, totalActivities: 4 },
      { completedActivities: 1, lessonId: lesson2.id, totalActivities: 5 },
      { completedActivities: 3, lessonId: lesson3.id, totalActivities: 7 },
    ]);

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}`);

    await expect(page.getByRole("heading", { level: 1, name: chapter.title })).toBeVisible();

    await expect(page.getByLabel("2 of 4 completed")).toBeVisible();
    await expect(page.getByLabel("1 of 5 completed")).toBeVisible();
    await expect(page.getByLabel("3 of 7 completed")).toBeVisible();
  });

  test("shows mix of completed, in-progress, and not-started states", async ({ page }) => {
    const { chapter, course, lesson1, lesson2, lesson3 } = await createTestChapterWithLessons();

    await mockChapterCompletionAPI(page, [
      { completedActivities: 4, lessonId: lesson1.id, totalActivities: 4 },
      { completedActivities: 2, lessonId: lesson2.id, totalActivities: 6 },
      { completedActivities: 0, lessonId: lesson3.id, totalActivities: 3 },
    ]);

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}`);

    await expect(page.getByRole("heading", { level: 1, name: chapter.title })).toBeVisible();

    // Lesson 1: fully completed -> checkmark
    const completedIndicators = page.getByRole("img", { name: /^completed$/i });
    await expect(completedIndicators).toHaveCount(1);

    // Lesson 2: partially completed -> fraction
    await expect(page.getByLabel("2 of 6 completed")).toBeVisible();

    // Lesson 3: not started -> nothing shown (0 completed)
  });
});
