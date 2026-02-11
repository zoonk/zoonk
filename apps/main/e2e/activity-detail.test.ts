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
      content: { text: `Test step content ${uniqueId}`, title: `Step ${uniqueId}`, variant: "text" },
      position: 0,
    });
  }

  return { activity, chapter, course, lesson };
}

async function createTestActivityWithInteractiveStep() {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-interactive-course-${uniqueId}`,
    title: `E2E Interactive Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-interactive-chapter-${uniqueId}`,
    title: `E2E Interactive Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: `E2E interactive lesson description ${uniqueId}`,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-interactive-lesson-${uniqueId}`,
    title: `E2E Interactive Lesson ${uniqueId}`,
  });

  const activity = await activityFixture({
    generationStatus: "completed",
    isPublished: true,
    kind: "quiz",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
    title: `E2E Interactive Activity ${uniqueId}`,
  });

  await stepFixture({
    activityId: activity.id,
    content: {
      kind: "core",
      options: [
        { feedback: "Correct!", isCorrect: true, text: "Option A" },
        { feedback: "Incorrect.", isCorrect: false, text: "Option B" },
      ],
      question: `Test question ${uniqueId}?`,
    },
    kind: "multipleChoice",
    position: 0,
  });

  return { activity, chapter, course, lesson };
}

test.describe("Activity Detail Page", () => {
  test("shows player shell for generated activity", async ({ page }) => {
    const { chapter, course, lesson } = await createTestActivity({
      generationStatus: "completed",
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`);

    await expect(page.getByRole("link", { name: /close/i })).toBeVisible();
    await expect(page.getByText(/1 \/ 1/)).toBeVisible();
    await expect(page.getByRole("progressbar")).toBeVisible();
  });

  test("close link has correct href", async ({ page }) => {
    const { chapter, course, lesson } = await createTestActivity({
      generationStatus: "completed",
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`);

    const closeLink = page.getByRole("link", { name: /close/i });

    await expect(closeLink).toHaveAttribute(
      "href",
      new RegExp(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`),
    );
  });

  test("interactive step shows disabled check button", async ({ page }) => {
    const { chapter, course, lesson } = await createTestActivityWithInteractiveStep();

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`);

    const checkButton = page.getByRole("button", { name: /check/i });
    await expect(checkButton).toBeVisible();
    await expect(checkButton).toBeDisabled();
  });

  test("static step does not show action bar", async ({ page }) => {
    const { chapter, course, lesson } = await createTestActivity({
      generationStatus: "completed",
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`);

    await expect(page.getByRole("link", { name: /close/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /check/i })).not.toBeVisible();
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
