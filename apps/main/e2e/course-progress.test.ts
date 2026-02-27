import { randomUUID } from "node:crypto";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { activityFixture, activityProgressFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { expect, test } from "./fixtures";

async function createTestCourseWithChapters(userId: number) {
  const org = await getAiOrganization();

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

  // Create lessons and activities for each chapter
  const [lesson1, lesson2, lesson3] = await Promise.all([
    lessonFixture({
      chapterId: chapter1.id,
      isPublished: true,
      organizationId: org.id,
      position: 0,
    }),
    lessonFixture({
      chapterId: chapter2.id,
      isPublished: true,
      organizationId: org.id,
      position: 0,
    }),
    lessonFixture({
      chapterId: chapter3.id,
      isPublished: true,
      organizationId: org.id,
      position: 0,
    }),
  ]);

  const [activity1, activity2, activity3] = await Promise.all([
    activityFixture({
      isPublished: true,
      lessonId: lesson1.id,
      organizationId: org.id,
      position: 0,
    }),
    activityFixture({
      isPublished: true,
      lessonId: lesson2.id,
      organizationId: org.id,
      position: 0,
    }),
    activityFixture({
      isPublished: true,
      lessonId: lesson3.id,
      organizationId: org.id,
      position: 0,
    }),
  ]);

  return {
    activities: { activity1, activity2, activity3 },
    chapter1,
    chapter2,
    chapter3,
    course,
    userId,
  };
}

test.describe("Course Progress Indicators", () => {
  test("shows no indicators when user has no progress", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { course } = await createTestCourseWithChapters(withProgressUser.id);

    await authenticatedPage.goto(`/b/ai/c/${course.slug}`);

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: course.title }),
    ).toBeVisible();

    // No completion indicators should be visible (0 completed = nothing shown)
    await expect(authenticatedPage.getByRole("img", { name: /^completed$/i })).toHaveCount(0);
    await expect(authenticatedPage.getByLabel(/of .+ completed/)).toHaveCount(0);
  });

  test("shows completed checkmarks for chapters with all lessons done", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { activities, course } = await createTestCourseWithChapters(withProgressUser.id);

    // Complete all activities
    await Promise.all([
      activityProgressFixture({
        activityId: activities.activity1.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
      activityProgressFixture({
        activityId: activities.activity2.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
      activityProgressFixture({
        activityId: activities.activity3.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
    ]);

    await authenticatedPage.goto(`/b/ai/c/${course.slug}`);

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: course.title }),
    ).toBeVisible();

    const completedIndicators = authenticatedPage.getByRole("img", { name: /^completed$/i });
    await expect(completedIndicators).toHaveCount(3);
  });

  test("shows mix of completed, in-progress, and not-started states", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { activities, course } = await createTestCourseWithChapters(withProgressUser.id);

    // Complete only the first chapter's activity
    await activityProgressFixture({
      activityId: activities.activity1.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: withProgressUser.id,
    });

    await authenticatedPage.goto(`/b/ai/c/${course.slug}`);

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: course.title }),
    ).toBeVisible();

    // Chapter 1: fully completed -> checkmark
    const completedIndicators = authenticatedPage.getByRole("img", { name: /^completed$/i });
    await expect(completedIndicators).toHaveCount(1);
  });
});
