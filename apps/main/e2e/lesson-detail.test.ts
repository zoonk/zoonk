import { randomUUID } from "node:crypto";
import { createOrganization, getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { expect, test } from "./fixtures";

async function createTestLesson(options?: {
  generationStatus?: "pending" | "completed";
  stepCount?: number;
}) {
  const org = await getAiOrganization();

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-lesson-course-${uniqueId}`,
    title: `E2E Lesson Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-lesson-chapter-${uniqueId}`,
    title: `E2E Lesson Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `E2E lesson description ${uniqueId}`,
    generationStatus: options?.generationStatus ?? "completed",
    isPublished: true,
    kind: "explanation",
    organizationId: org.id,
    slug: `e2e-lesson-lesson-${uniqueId}`,
    title: `E2E Lesson Lesson ${uniqueId}`,
  });

  if (options?.generationStatus !== "pending") {
    const count = options?.stepCount ?? 1;

    await Promise.all(
      Array.from({ length: count }, (_, idx) =>
        stepFixture({
          content: {
            text: `Test step content ${uniqueId} #${idx}`,
            title: `Step ${uniqueId} #${idx}`,
            variant: "text",
          },
          isPublished: true,
          lessonId: lesson.id,
          position: idx,
        }),
      ),
    );
  }

  return { chapter, course, lesson, uniqueId };
}

test.describe("Lesson Player Page", () => {
  test("generated lesson player renders the seeded step content", async ({ page }) => {
    const { chapter, course, lesson, uniqueId } = await createTestLesson({
      generationStatus: "completed",
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(page.getByRole("heading", { name: `Step ${uniqueId} #0` })).toBeVisible();
    await expect(page.getByText(`Test step content ${uniqueId} #0`)).toBeVisible();
  });

  test("close link has correct href", async ({ page }) => {
    const { chapter, course, lesson } = await createTestLesson({
      generationStatus: "completed",
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    const closeLink = page.getByRole("link", { name: /close/i });

    await expect(closeLink).toHaveAttribute(
      "href",
      new RegExp(`/b/ai/c/${course.slug}/ch/${chapter.slug}$`),
    );
  });

  test("pending lessons show the create state and link details", async ({ page }) => {
    const { lesson, chapter, course } = await createTestLesson({
      generationStatus: "pending",
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(page.getByText(/lesson not available/i)).toBeVisible();
    await expect(page.getByText(/hasn't been created yet/i)).toBeVisible();
    const generateLink = page.getByRole("link", { name: /create lesson/i });

    await expect(generateLink).toBeVisible();
    await expect(generateLink).toHaveAttribute("href", new RegExp(`/generate/l/${lesson.id}`));
    await expect(generateLink).toHaveAttribute("rel", "nofollow");
  });

  test("pending non-AI lessons do not show a generate link", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const org = await createOrganization();
    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
      slug: `non-ai-lesson-course-${uniqueId}`,
      title: `Non AI Lesson Course ${uniqueId}`,
    });
    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
      slug: `non-ai-lesson-chapter-${uniqueId}`,
      title: `Non AI Lesson Chapter ${uniqueId}`,
    });
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      organizationId: org.id,
      slug: `non-ai-lesson-lesson-${uniqueId}`,
      title: `Non AI Lesson Lesson ${uniqueId}`,
    });

    await page.goto(`/b/${org.slug}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(page.getByText(/lesson not available/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /create lesson/i })).not.toBeVisible();
  });

  test("pressing escape navigates to the chapter page", async ({ page }) => {
    const { chapter, course, lesson } = await createTestLesson({
      generationStatus: "completed",
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(page.getByRole("link", { name: /close/i })).toBeVisible();

    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Escape");

    await expect(page).toHaveURL(new RegExp(`/b/ai/c/${course.slug}/ch/${chapter.slug}$`));
  });

  test("non-existent lesson shows 404 page", async ({ page }) => {
    const { chapter, course, uniqueId } = await createTestLesson();

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/missing-${uniqueId}`);

    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });

  test("page title contains lesson title", async ({ page }) => {
    const { chapter, course, lesson } = await createTestLesson({
      generationStatus: "completed",
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(page).toHaveTitle(new RegExp(lesson.title));
  });

  test("unpublished lesson shows 404 page", async ({ page }) => {
    const org = await getAiOrganization();

    const uniqueId = randomUUID().slice(0, 8);

    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-unpub-lesson-course-${uniqueId}`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-unpub-lesson-chapter-${uniqueId}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: false,
      organizationId: org.id,
      slug: `e2e-unpub-lesson-lesson-${uniqueId}`,
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });
});
