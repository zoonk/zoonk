import { randomUUID } from "node:crypto";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { activityFixture, activityProgressFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { expect, test } from "./fixtures";

/**
 * Create a course with 3 chapters, each having multiple lessons with activities.
 * This allows testing partial completion (fraction indicators).
 *
 * Structure per chapter:
 * - Chapter 1: 3 lessons × 1 activity each
 * - Chapter 2: 2 lessons × 1 activity each
 * - Chapter 3: 2 lessons × 1 activity each
 */
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

  // Chapter 1: 3 lessons
  const [ch1Lesson1, ch1Lesson2, ch1Lesson3] = await Promise.all([
    lessonFixture({
      chapterId: chapter1.id,
      isPublished: true,
      organizationId: org.id,
      position: 0,
    }),
    lessonFixture({
      chapterId: chapter1.id,
      isPublished: true,
      organizationId: org.id,
      position: 1,
    }),
    lessonFixture({
      chapterId: chapter1.id,
      isPublished: true,
      organizationId: org.id,
      position: 2,
    }),
  ]);

  // Chapter 2: 2 lessons
  const [ch2Lesson1, ch2Lesson2] = await Promise.all([
    lessonFixture({
      chapterId: chapter2.id,
      isPublished: true,
      organizationId: org.id,
      position: 0,
    }),
    lessonFixture({
      chapterId: chapter2.id,
      isPublished: true,
      organizationId: org.id,
      position: 1,
    }),
  ]);

  // Chapter 3: 2 lessons
  const [ch3Lesson1, ch3Lesson2] = await Promise.all([
    lessonFixture({
      chapterId: chapter3.id,
      isPublished: true,
      organizationId: org.id,
      position: 0,
    }),
    lessonFixture({
      chapterId: chapter3.id,
      isPublished: true,
      organizationId: org.id,
      position: 1,
    }),
  ]);

  // 1 activity per lesson
  const [ch1Act1, ch1Act2, ch1Act3, ch2Act1, ch2Act2, ch3Act1, ch3Act2] = await Promise.all([
    activityFixture({
      isPublished: true,
      lessonId: ch1Lesson1.id,
      organizationId: org.id,
      position: 0,
    }),
    activityFixture({
      isPublished: true,
      lessonId: ch1Lesson2.id,
      organizationId: org.id,
      position: 0,
    }),
    activityFixture({
      isPublished: true,
      lessonId: ch1Lesson3.id,
      organizationId: org.id,
      position: 0,
    }),
    activityFixture({
      isPublished: true,
      lessonId: ch2Lesson1.id,
      organizationId: org.id,
      position: 0,
    }),
    activityFixture({
      isPublished: true,
      lessonId: ch2Lesson2.id,
      organizationId: org.id,
      position: 0,
    }),
    activityFixture({
      isPublished: true,
      lessonId: ch3Lesson1.id,
      organizationId: org.id,
      position: 0,
    }),
    activityFixture({
      isPublished: true,
      lessonId: ch3Lesson2.id,
      organizationId: org.id,
      position: 0,
    }),
  ]);

  return {
    activities: { ch1Act1, ch1Act2, ch1Act3, ch2Act1, ch2Act2, ch3Act1, ch3Act2 },
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

    await expect(authenticatedPage.getByRole("img", { name: /^completed$/i })).toHaveCount(0);
    await expect(authenticatedPage.getByLabel(/of .+ completed/)).toHaveCount(0);
  });

  test("shows completed checkmarks for chapters with all lessons done", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { activities, course } = await createTestCourseWithChapters(withProgressUser.id);

    // Complete all activities across all chapters
    await Promise.all([
      activityProgressFixture({
        activityId: activities.ch1Act1.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
      activityProgressFixture({
        activityId: activities.ch1Act2.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
      activityProgressFixture({
        activityId: activities.ch1Act3.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
      activityProgressFixture({
        activityId: activities.ch2Act1.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
      activityProgressFixture({
        activityId: activities.ch2Act2.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
      activityProgressFixture({
        activityId: activities.ch3Act1.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
      activityProgressFixture({
        activityId: activities.ch3Act2.id,
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

  test("shows fraction text for partially completed chapters", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { activities, course } = await createTestCourseWithChapters(withProgressUser.id);

    // Chapter 1 (3 lessons): complete 1 of 3 lessons
    await activityProgressFixture({
      activityId: activities.ch1Act1.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: withProgressUser.id,
    });

    // Chapter 2 (2 lessons): complete 1 of 2 lessons
    await activityProgressFixture({
      activityId: activities.ch2Act1.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: withProgressUser.id,
    });

    await authenticatedPage.goto(`/b/ai/c/${course.slug}`);

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: course.title }),
    ).toBeVisible();

    await expect(authenticatedPage.getByLabel("1 of 3 completed")).toBeVisible();
    await expect(authenticatedPage.getByLabel("1 of 2 completed")).toBeVisible();
  });

  test("shows mix of completed, in-progress, and not-started states", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { activities, course } = await createTestCourseWithChapters(withProgressUser.id);

    // Chapter 1 (3 lessons): complete all -> checkmark
    await Promise.all([
      activityProgressFixture({
        activityId: activities.ch1Act1.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
      activityProgressFixture({
        activityId: activities.ch1Act2.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
      activityProgressFixture({
        activityId: activities.ch1Act3.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
    ]);

    // Chapter 2 (2 lessons): complete 1 of 2 -> fraction
    await activityProgressFixture({
      activityId: activities.ch2Act1.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: withProgressUser.id,
    });

    // Chapter 3: no progress -> nothing shown

    await authenticatedPage.goto(`/b/ai/c/${course.slug}`);

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: course.title }),
    ).toBeVisible();

    // Chapter 1: fully completed -> checkmark
    const completedIndicators = authenticatedPage.getByRole("img", { name: /^completed$/i });
    await expect(completedIndicators).toHaveCount(1);

    // Chapter 2: partially completed -> fraction
    await expect(authenticatedPage.getByLabel("1 of 2 completed")).toBeVisible();
  });
});
