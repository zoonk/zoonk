import { randomUUID } from "node:crypto";
import { createOrganization, getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { expect, test } from "./fixtures";

async function createTestActivity(options?: {
  generationStatus?: "pending" | "completed";
  stepCount?: number;
}) {
  const org = await getAiOrganization();

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
    kind: "explanation",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
  });

  if (options?.generationStatus !== "pending") {
    const count = options?.stepCount ?? 1;

    await Promise.all(
      Array.from({ length: count }, (_, idx) =>
        stepFixture({
          activityId: activity.id,
          content: {
            text: `Test step content ${uniqueId} #${idx}`,
            title: `Step ${uniqueId} #${idx}`,
            variant: "text",
          },
          isPublished: true,
          position: idx,
        }),
      ),
    );
  }

  return { activity, chapter, course, lesson, uniqueId };
}

test.describe("Activity Detail Page", () => {
  test("generated activity page renders the seeded step content", async ({ page }) => {
    const { chapter, course, lesson, uniqueId } = await createTestActivity({
      generationStatus: "completed",
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`);

    await expect(page.getByRole("heading", { name: `Step ${uniqueId} #0` })).toBeVisible();
    await expect(page.getByText(`Test step content ${uniqueId} #0`)).toBeVisible();
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

  test("pending activities show the create state and link details", async ({ page }) => {
    const { activity, chapter, course, lesson } = await createTestActivity({
      generationStatus: "pending",
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`);

    await expect(page.getByText(/activity not available/i)).toBeVisible();
    await expect(page.getByText(/hasn't been created yet/i)).toBeVisible();
    const generateLink = page.getByRole("link", { name: /create activity/i });

    await expect(generateLink).toBeVisible();
    await expect(generateLink).toHaveAttribute("href", new RegExp(`/generate/a/${activity.id}`));
    await expect(generateLink).toHaveAttribute("rel", "nofollow");
  });

  test("pending non-AI activities do not show a generate link", async ({ page }) => {
    const uniqueId = randomUUID().slice(0, 8);
    const org = await createOrganization();
    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
      slug: `non-ai-activity-course-${uniqueId}`,
      title: `Non AI Activity Course ${uniqueId}`,
    });
    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: org.id,
      slug: `non-ai-activity-chapter-${uniqueId}`,
      title: `Non AI Activity Chapter ${uniqueId}`,
    });
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: org.id,
      slug: `non-ai-activity-lesson-${uniqueId}`,
      title: `Non AI Activity Lesson ${uniqueId}`,
    });
    await activityFixture({
      generationStatus: "pending",
      isPublished: true,
      lessonId: lesson.id,
      organizationId: org.id,
      position: 0,
      title: `Non AI Activity ${uniqueId}`,
    });

    await page.goto(`/b/${org.slug}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`);

    await expect(page.getByText(/activity not available/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /create activity/i })).not.toBeVisible();
  });

  test("pressing escape navigates to lesson page", async ({ page }) => {
    const { chapter, course, lesson } = await createTestActivity({
      generationStatus: "completed",
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`);

    await expect(page.getByRole("link", { name: /close/i })).toBeVisible();

    // Wait for hydration so the keyboard listener from useEffect is attached
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Escape");

    await expect(page).toHaveURL(
      new RegExp(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}$`),
    );
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

  test("page title contains kind label and lesson title", async ({ page }) => {
    const { chapter, course, lesson } = await createTestActivity({
      generationStatus: "completed",
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`);

    await expect(page).toHaveTitle(new RegExp(lesson.title));
    await expect(page).toHaveTitle(/explanation/i);
  });

  test("unpublished activity shows 404 page", async ({ page }) => {
    const org = await getAiOrganization();

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
      kind: "explanation",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 0,
    });

    await page.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}/a/0`);

    await expect(page.getByText(/not found|404/i)).toBeVisible();
  });
});
