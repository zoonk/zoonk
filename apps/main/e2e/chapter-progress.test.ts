import { randomUUID } from "node:crypto";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { activityFixture, activityProgressFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { expect, test } from "./fixtures";

/**
 * Create a chapter with 3 lessons, each having multiple activities.
 * This allows testing partial completion (fraction indicators).
 *
 * Structure:
 * - Lesson 1: 4 activities
 * - Lesson 2: 3 activities
 * - Lesson 3: 2 activities
 */
async function createTestChapterWithLessons(userId: number) {
  const org = await getAiOrganization();
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

  // Lesson 1: 4 activities
  const [l1Act1, l1Act2, l1Act3, l1Act4] = await Promise.all([
    activityFixture({
      isPublished: true,
      lessonId: lesson1.id,
      organizationId: org.id,
      position: 0,
    }),
    activityFixture({
      isPublished: true,
      lessonId: lesson1.id,
      organizationId: org.id,
      position: 1,
    }),
    activityFixture({
      isPublished: true,
      lessonId: lesson1.id,
      organizationId: org.id,
      position: 2,
    }),
    activityFixture({
      isPublished: true,
      lessonId: lesson1.id,
      organizationId: org.id,
      position: 3,
    }),
  ]);

  // Lesson 2: 3 activities
  const [l2Act1, l2Act2, l2Act3] = await Promise.all([
    activityFixture({
      isPublished: true,
      lessonId: lesson2.id,
      organizationId: org.id,
      position: 0,
    }),
    activityFixture({
      isPublished: true,
      lessonId: lesson2.id,
      organizationId: org.id,
      position: 1,
    }),
    activityFixture({
      isPublished: true,
      lessonId: lesson2.id,
      organizationId: org.id,
      position: 2,
    }),
  ]);

  // Lesson 3: 2 activities
  const [l3Act1, l3Act2] = await Promise.all([
    activityFixture({
      isPublished: true,
      lessonId: lesson3.id,
      organizationId: org.id,
      position: 0,
    }),
    activityFixture({
      isPublished: true,
      lessonId: lesson3.id,
      organizationId: org.id,
      position: 1,
    }),
  ]);

  return {
    activities: { l1Act1, l1Act2, l1Act3, l1Act4, l2Act1, l2Act2, l2Act3, l3Act1, l3Act2 },
    chapter,
    course,
    lesson1,
    lesson2,
    lesson3,
    userId,
  };
}

test.describe("Chapter Progress Indicators", () => {
  test("shows no indicators when user has no progress", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { chapter, course } = await createTestChapterWithLessons(withProgressUser.id);

    await authenticatedPage.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}`);

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: chapter.title }),
    ).toBeVisible();

    await expect(authenticatedPage.getByRole("img", { name: /^completed$/i })).toHaveCount(0);
    await expect(authenticatedPage.getByLabel(/of .+ completed/)).toHaveCount(0);
  });

  test("shows completed checkmarks for lessons with all activities done", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { activities, chapter, course } = await createTestChapterWithLessons(withProgressUser.id);

    // Complete all activities across all lessons
    await Promise.all([
      activityProgressFixture({
        activityId: activities.l1Act1.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
      activityProgressFixture({
        activityId: activities.l1Act2.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
      activityProgressFixture({
        activityId: activities.l1Act3.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
      activityProgressFixture({
        activityId: activities.l1Act4.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
      activityProgressFixture({
        activityId: activities.l2Act1.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
      activityProgressFixture({
        activityId: activities.l2Act2.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
      activityProgressFixture({
        activityId: activities.l2Act3.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
      activityProgressFixture({
        activityId: activities.l3Act1.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
      activityProgressFixture({
        activityId: activities.l3Act2.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
    ]);

    await authenticatedPage.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}`);

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: chapter.title }),
    ).toBeVisible();

    const completedIndicators = authenticatedPage.getByRole("img", { name: /^completed$/i });
    await expect(completedIndicators).toHaveCount(3);
  });

  test("shows fraction text for partially completed lessons", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { activities, chapter, course } = await createTestChapterWithLessons(withProgressUser.id);

    // Lesson 1 (4 activities): complete 2 of 4
    await Promise.all([
      activityProgressFixture({
        activityId: activities.l1Act1.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
      activityProgressFixture({
        activityId: activities.l1Act2.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
    ]);

    // Lesson 2 (3 activities): complete 1 of 3
    await activityProgressFixture({
      activityId: activities.l2Act1.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: withProgressUser.id,
    });

    await authenticatedPage.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}`);

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: chapter.title }),
    ).toBeVisible();

    await expect(authenticatedPage.getByLabel("2 of 4 completed")).toBeVisible();
    await expect(authenticatedPage.getByLabel("1 of 3 completed")).toBeVisible();
  });

  test("shows mix of completed, in-progress, and not-started states", async ({
    authenticatedPage,
    withProgressUser,
  }) => {
    const { activities, chapter, course } = await createTestChapterWithLessons(withProgressUser.id);

    // Lesson 1 (4 activities): complete all -> checkmark
    await Promise.all([
      activityProgressFixture({
        activityId: activities.l1Act1.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
      activityProgressFixture({
        activityId: activities.l1Act2.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
      activityProgressFixture({
        activityId: activities.l1Act3.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
      activityProgressFixture({
        activityId: activities.l1Act4.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
    ]);

    // Lesson 2 (3 activities): complete 2 of 3 -> fraction
    await Promise.all([
      activityProgressFixture({
        activityId: activities.l2Act1.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
      activityProgressFixture({
        activityId: activities.l2Act2.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: withProgressUser.id,
      }),
    ]);

    // Lesson 3: no progress -> nothing shown

    await authenticatedPage.goto(`/b/ai/c/${course.slug}/ch/${chapter.slug}`);

    await expect(
      authenticatedPage.getByRole("heading", { level: 1, name: chapter.title }),
    ).toBeVisible();

    // Lesson 1: fully completed -> checkmark
    const completedIndicators = authenticatedPage.getByRole("img", { name: /^completed$/i });
    await expect(completedIndicators).toHaveCount(1);

    // Lesson 2: partially completed -> fraction
    await expect(authenticatedPage.getByLabel("2 of 3 completed")).toBeVisible();
  });
});
