import { randomUUID } from "node:crypto";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { activityFixture, activityProgressFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
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
    kind: "explanation",
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
    kind: "explanation",
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

  test("shows Continue linking to lesson page when next lesson is ungenerated", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { activity, chapter, course, org } = await createTestCourseWithActivity();

    const uniqueId = randomUUID().slice(0, 8);

    const pendingLesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      organizationId: org.id,
      position: 1,
      slug: `e2e-cal-pending-l-${uniqueId}`,
      title: `E2E CAL Pending Lesson ${uniqueId}`,
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
    await expect(continueLink).toHaveAttribute(
      "href",
      `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${pendingLesson.slug}`,
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

  test("lesson page shows Continue linking to next lesson when completed", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { activity, chapter, course, lesson, org } = await createTestCourseWithActivity();

    const uniqueId = randomUUID().slice(0, 8);

    const nextLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: org.id,
      position: 1,
      slug: `e2e-cal-next-l-${uniqueId}`,
      title: `E2E CAL Next Lesson ${uniqueId}`,
    });

    await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
      lessonId: nextLesson.id,
      organizationId: org.id,
      position: 0,
    });

    await activityProgressFixture({
      activityId: activity.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: withProgressUser.id,
    });

    await authenticatedPage.goto(
      `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`,
    );

    const continueLink = authenticatedPage.getByRole("link", { name: /^continue$/i });
    await expect(continueLink).toBeVisible();
    await expect(continueLink).toHaveAttribute(
      "href",
      `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${nextLesson.slug}`,
    );
  });

  test("chapter page shows Continue linking to next chapter when completed", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const org = await getAiOrganization();
    const uniqueId = randomUUID().slice(0, 8);

    const course = await courseFixture({
      isPublished: true,
      organizationId: org.id,
      slug: `e2e-cal-chcomp-${uniqueId}`,
      title: `E2E CAL ChComp ${uniqueId}`,
    });

    const [chapter1, chapter2] = await Promise.all([
      chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: org.id,
        position: 0,
        slug: `e2e-cal-chcomp-ch1-${uniqueId}`,
        title: `E2E CAL ChComp Ch1 ${uniqueId}`,
      }),
      chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: org.id,
        position: 1,
        slug: `e2e-cal-chcomp-ch2-${uniqueId}`,
        title: `E2E CAL ChComp Ch2 ${uniqueId}`,
      }),
    ]);

    const [lesson1, lesson2] = await Promise.all([
      lessonFixture({
        chapterId: chapter1.id,
        isPublished: true,
        organizationId: org.id,
        position: 0,
        slug: `e2e-cal-chcomp-l1-${uniqueId}`,
        title: `E2E CAL ChComp L1 ${uniqueId}`,
      }),
      lessonFixture({
        chapterId: chapter2.id,
        isPublished: true,
        organizationId: org.id,
        position: 0,
        slug: `e2e-cal-chcomp-l2-${uniqueId}`,
        title: `E2E CAL ChComp L2 ${uniqueId}`,
      }),
    ]);

    const [activity1] = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        kind: "explanation",
        lessonId: lesson1.id,
        organizationId: org.id,
        position: 0,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        kind: "explanation",
        lessonId: lesson2.id,
        organizationId: org.id,
        position: 0,
      }),
    ]);

    await activityProgressFixture({
      activityId: activity1.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: withProgressUser.id,
    });

    await authenticatedPage.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter1.slug}`);

    const continueLink = authenticatedPage.getByRole("link", { name: /^continue$/i });
    await expect(continueLink).toBeVisible();
    await expect(continueLink).toHaveAttribute(
      "href",
      `/b/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter2.slug}`,
    );
  });

  test("course page shows Review when all activities completed", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { activity, course } = await createTestCourseWithActivity();

    await activityProgressFixture({
      activityId: activity.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: withProgressUser.id,
    });

    await authenticatedPage.goto(`/b/${AI_ORG_SLUG}/c/${course.slug}`);

    const reviewLink = authenticatedPage.getByRole("link", { name: /^review$/i });
    await expect(reviewLink).toBeVisible();
  });
});
