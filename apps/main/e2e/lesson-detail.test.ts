import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { expect, test } from "./fixtures";

async function createTestLessonWithActivities() {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-course-${uniqueId}`,
    title: `E2E Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-chapter-${uniqueId}`,
    title: `E2E Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `E2E lesson description ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-lesson-${uniqueId}`,
    title: `E2E Lesson ${uniqueId}`,
  });

  // Create activities for the lesson
  await activityFixture({
    isPublished: true,
    kind: "background",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
  });

  await activityFixture({
    isPublished: true,
    kind: "explanation",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 1,
  });

  await activityFixture({
    isPublished: true,
    kind: "quiz",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 2,
  });

  await activityFixture({
    isPublished: true,
    kind: "challenge",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 3,
  });

  return { chapter, course, lesson };
}

test.describe("Lesson Detail Page", () => {
  test("shows lesson content with title, description, and position", async ({ page }) => {
    const { chapter, course, lesson } = await createTestLessonWithActivities();
    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: lesson.title,
      }),
    ).toBeVisible();

    await expect(page.getByText(lesson.description)).toBeVisible();

    const positionIcon = page.getByRole("img", { name: /lesson 01/i });
    await expect(positionIcon).toBeVisible();
  });

  test("non-existent lesson shows 404 page", async ({ page }) => {
    await page.goto(
      "/b/ai/c/machine-learning/ch/introduction-to-machine-learning/l/nonexistent-lesson",
    );

    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });

  test("unpublished lesson shows 404 page", async ({ page }) => {
    await page.goto(
      "/b/ai/c/machine-learning/ch/introduction-to-machine-learning/l/types-of-learning",
    );

    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });

  test("clicking links in popover navigates correctly", async ({ page }) => {
    const { chapter, course, lesson } = await createTestLessonWithActivities();
    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    const triggerButton = page.getByRole("button", {
      name: lesson.title,
    });
    await triggerButton.click();

    // Verify course link is visible
    await expect(page.getByRole("link", { name: course.title })).toBeVisible();

    // Verify chapter link is visible
    await expect(page.getByRole("link", { name: chapter.title })).toBeVisible();

    // Click the course link
    const courseLink = page.getByRole("link", { name: course.title });
    await courseLink.click({ force: true });

    // Verify URL is correct
    await expect(page).toHaveURL(new RegExp(`/b/ai/c/${course.slug}$`));

    // Verify we're on the course page
    await expect(page.getByRole("heading", { level: 1, name: course.title })).toBeVisible();
  });

  test("displays activity list with titles and descriptions", async ({ page }) => {
    const { chapter, course, lesson } = await createTestLessonWithActivities();
    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    // Scope to the activity list for precise queries
    const activityList = page.getByRole("list", { name: /activities/i });

    await expect(activityList.getByRole("link", { name: /background/i })).toBeVisible();
    await expect(activityList.getByText(/explains why this topic exists/i)).toBeVisible();

    await expect(activityList.getByRole("link", { name: /explanation/i })).toBeVisible();
    await expect(activityList.getByText(/explains what this topic is/i)).toBeVisible();

    await expect(activityList.getByRole("link", { name: /quiz/i })).toBeVisible();
    await expect(activityList.getByText(/tests your understanding/i)).toBeVisible();

    await expect(activityList.getByRole("link", { name: /challenge/i })).toBeVisible();
    await expect(activityList.getByText(/tests analytical thinking/i)).toBeVisible();
  });

  test("clicking activity link navigates to activity page", async ({ page }) => {
    const { chapter, course, lesson } = await createTestLessonWithActivities();
    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    // Scope to the activity list for precise query
    const activityList = page.getByRole("list", { name: /activities/i });
    const activityLink = activityList.getByRole("link", { name: /background/i });
    await activityLink.click();

    await expect(page).toHaveURL(new RegExp(`/l/${lesson.slug}/a/0`));
  });

  test("lesson without activities redirects to generate page", async ({ page }) => {
    await page.goto("/b/ai/c/machine-learning/ch/data-preparation/l/understanding-datasets");

    await expect(page).toHaveURL(/\/generate\/l\/\d+/);
  });
});
