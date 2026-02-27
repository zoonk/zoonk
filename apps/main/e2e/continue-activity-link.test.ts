import { randomUUID } from "node:crypto";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { activityFixture, activityProgressFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { expect, test } from "./fixtures";

async function createTestCourseWithActivity() {
  const org = await getAiOrganization();

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

  const activity = await activityFixture({
    generationStatus: "completed",
    isPublished: true,
    kind: "background",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
    title: `E2E CAL Activity ${uniqueId}`,
  });

  return { activity, chapter, course, lesson, org };
}

async function createTestCourseWithoutPublishedActivities() {
  const org = await getAiOrganization();

  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-cal-noact-${uniqueId}`,
    title: `E2E CAL NoAct ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    slug: `e2e-cal-noact-ch-${uniqueId}`,
    title: `E2E CAL NoAct Ch ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    isPublished: true,
    organizationId: org.id,
    position: 0,
    slug: `e2e-cal-noact-l-${uniqueId}`,
    title: `E2E CAL NoAct Lesson ${uniqueId}`,
  });

  // Unpublished activity so getNextActivity returns null
  await activityFixture({
    isPublished: false,
    kind: "background",
    lessonId: lesson.id,
    organizationId: org.id,
    position: 0,
  });

  return { chapter, course, lesson };
}

test.describe("Continue Activity Link", () => {
  test("course page shows Start link for unauthenticated user", async ({ page }) => {
    const { course } = await createTestCourseWithActivity();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    const startLink = page.getByRole("link", { name: /^start$/i });
    await expect(startLink).toBeVisible();
  });

  test("course page Start link navigates to an activity URL", async ({ page }) => {
    const { course } = await createTestCourseWithActivity();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    const startLink = page.getByRole("link", { name: /^start$/i });
    await expect(startLink).toBeVisible();
    await startLink.click();

    await expect(page).toHaveURL(/\/a\/\d+$/);
  });

  test("chapter page shows Start link for unauthenticated user", async ({ page }) => {
    const { chapter, course } = await createTestCourseWithActivity();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}`);

    const startLink = page.getByRole("link", { name: /^start$/i });
    await expect(startLink).toBeVisible();
  });

  test("lesson page shows Start link for unauthenticated user", async ({ page }) => {
    const { chapter, course, lesson } = await createTestCourseWithActivity();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`);

    const startLink = page.getByRole("link", { name: /^start$/i });
    await expect(startLink).toBeVisible();
  });

  test("course page falls back to first chapter when no activity data", async ({ page }) => {
    const { chapter, course } = await createTestCourseWithoutPublishedActivities();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    const startLink = page.getByRole("link", { name: /^start$/i });
    await expect(startLink).toBeVisible();
    await expect(startLink).toHaveAttribute(
      "href",
      expect.stringContaining(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}`),
    );
  });

  test("chapter page falls back to first lesson when no activity data", async ({ page }) => {
    const { chapter, course, lesson } = await createTestCourseWithoutPublishedActivities();

    await page.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}`);

    const startLink = page.getByRole("link", { name: /^start$/i });
    await expect(startLink).toBeVisible();
    await expect(startLink).toHaveAttribute(
      "href",
      expect.stringContaining(`/ch/${chapter.slug}/l/${lesson.slug}`),
    );
  });

  test("authenticated user with progress sees Continue on course page", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { activity, course, lesson, org } = await createTestCourseWithActivity();

    await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
      lessonId: lesson.id,
      organizationId: org.id,
      position: 1,
      title: `E2E CAL Activity 2 ${course.slug}`,
    });

    await activityProgressFixture({
      activityId: activity.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: withProgressUser.id,
    });

    await authenticatedPage.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    const continueLink = authenticatedPage.getByRole("link", { name: /^continue$/i });
    await expect(continueLink).toBeVisible();
  });
});
