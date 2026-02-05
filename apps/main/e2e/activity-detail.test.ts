import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { expect, test } from "./fixtures";

async function createTestActivity(options?: { generationStatus?: "pending" | "completed" }) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-activity-course-${uniqueId}`,
    title: `E2E Activity Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-activity-chapter-${uniqueId}`,
    title: `E2E Activity Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `E2E activity lesson description ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-activity-lesson-${uniqueId}`,
    title: `E2E Activity Lesson ${uniqueId}`,
  });

  const activity = await activityFixture({
    generationStatus: options?.generationStatus ?? "completed",
    isPublished: true,
    kind: "background",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
    title: `E2E Activity ${uniqueId}`,
  });

  if (options?.generationStatus !== "pending") {
    await stepFixture({
      activityId: activity.id,
      content: { text: `Test step content ${uniqueId}`, title: `Step ${uniqueId}` },
      position: 0,
    });
  }

  return { activity, chapter, course, lesson };
}

test.describe("Activity Detail Page", () => {
  test("shows activity content for generated activity", async ({ page }) => {
    const { chapter, course, lesson } = await createTestActivity({
      generationStatus: "completed",
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`);

    await expect(page.getByRole("main")).toBeVisible();

    await expect(page.getByText(/"generationStatus":\s*"completed"/)).toBeVisible();
  });

  test("shows not generated state for pending activity", async ({ page }) => {
    const { chapter, course, lesson } = await createTestActivity({
      generationStatus: "pending",
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`);

    await expect(page.getByText(/activity not available/i)).toBeVisible();
    await expect(page.getByText(/hasn't been generated yet/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /generate activity/i })).toBeVisible();
  });

  test("generate link has correct href", async ({ page }) => {
    const { activity, chapter, course, lesson } = await createTestActivity({
      generationStatus: "pending",
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`);

    const generateLink = page.getByRole("link", { name: /generate activity/i });
    await expect(generateLink).toHaveAttribute("href", new RegExp(`/generate/a/${activity.id}`));
  });

  test("generate link has nofollow attribute", async ({ page }) => {
    const { chapter, course, lesson } = await createTestActivity({
      generationStatus: "pending",
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`);

    const generateLink = page.getByRole("link", { name: /generate activity/i });
    await expect(generateLink).toHaveAttribute("rel", "nofollow");
  });

  test("non-existent activity shows 404 page", async ({ page }) => {
    const { chapter, course, lesson } = await createTestActivity();

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/999`);

    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });

  test("invalid position shows 404 page", async ({ page }) => {
    const { chapter, course, lesson } = await createTestActivity();

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/invalid`);

    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });

  test("unpublished activity shows 404 page", async ({ page }) => {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { slug: "ai" },
    });

    const uniqueId = randomUUID().slice(0, 8);

    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-unpub-activity-course-${uniqueId}`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-unpub-activity-chapter-${uniqueId}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-unpub-activity-lesson-${uniqueId}`,
    });

    await activityFixture({
      isPublished: false,
      kind: "background",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 0,
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`);

    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });
});
