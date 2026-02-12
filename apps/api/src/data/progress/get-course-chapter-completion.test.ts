import { activityFixture, activityProgressFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, test } from "vitest";
import { getCourseChapterCompletion } from "./get-course-chapter-completion";

describe(getCourseChapterCompletion, () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;

  beforeAll(async () => {
    organization = await organizationFixture();
  });

  test("returns empty array when userId is 0", async () => {
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });
    const result = await getCourseChapterCompletion(0, course.id);
    expect(result).toEqual([]);
  });

  test("returns chapters with zero counts when user has no progress", async () => {
    const [user, course] = await Promise.all([
      userFixture(),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    await activityFixture({
      isPublished: true,
      lessonId: lesson.id,
      organizationId: organization.id,
      position: 0,
    });

    const result = await getCourseChapterCompletion(Number(user.id), course.id);
    expect(result).toEqual([{ chapterId: chapter.id, completedLessons: 0, totalLessons: 1 }]);
  });

  test("a lesson counts as completed only when ALL its activities are completed", async () => {
    const [user, course] = await Promise.all([
      userFixture(),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const [activity1, activity2] = await Promise.all([
      activityFixture({
        isPublished: true,
        lessonId: lesson.id,
        organizationId: organization.id,
        position: 0,
      }),
      activityFixture({
        isPublished: true,
        lessonId: lesson.id,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    // Only complete one of two activities
    await activityProgressFixture({
      activityId: activity1.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: Number(user.id),
    });

    const result = await getCourseChapterCompletion(Number(user.id), course.id);
    expect(result).toEqual([{ chapterId: chapter.id, completedLessons: 0, totalLessons: 1 }]);

    // Now complete the second activity
    await activityProgressFixture({
      activityId: activity2.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: Number(user.id),
    });

    const result2 = await getCourseChapterCompletion(Number(user.id), course.id);
    expect(result2).toEqual([{ chapterId: chapter.id, completedLessons: 1, totalLessons: 1 }]);
  });

  test("returns correct counts across multiple chapters", async () => {
    const [user, course] = await Promise.all([
      userFixture(),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    const [chapter1, chapter2] = await Promise.all([
      chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
      chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    const [lesson1, lesson2] = await Promise.all([
      lessonFixture({
        chapterId: chapter1.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter2.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
    ]);

    const [activity1, _activity2] = await Promise.all([
      activityFixture({
        isPublished: true,
        lessonId: lesson1.id,
        organizationId: organization.id,
        position: 0,
      }),
      activityFixture({
        isPublished: true,
        lessonId: lesson2.id,
        organizationId: organization.id,
        position: 0,
      }),
    ]);

    // Complete only the first chapter's lesson
    await activityProgressFixture({
      activityId: activity1.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: Number(user.id),
    });

    const result = await getCourseChapterCompletion(Number(user.id), course.id);
    expect(result).toEqual([
      { chapterId: chapter1.id, completedLessons: 1, totalLessons: 1 },
      { chapterId: chapter2.id, completedLessons: 0, totalLessons: 1 },
    ]);
  });

  test("excludes started-but-not-completed activities from lesson completion", async () => {
    const [user, course] = await Promise.all([
      userFixture(),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const activity = await activityFixture({
      isPublished: true,
      lessonId: lesson.id,
      organizationId: organization.id,
      position: 0,
    });

    // Started but not completed
    await activityProgressFixture({
      activityId: activity.id,
      completedAt: null,
      durationSeconds: 30,
      userId: Number(user.id),
    });

    const result = await getCourseChapterCompletion(Number(user.id), course.id);
    expect(result).toEqual([{ chapterId: chapter.id, completedLessons: 0, totalLessons: 1 }]);
  });

  test("only counts published activities and lessons", async () => {
    const [user, course] = await Promise.all([
      userFixture(),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const [publishedLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        isPublished: false,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    const [publishedActivity] = await Promise.all([
      activityFixture({
        isPublished: true,
        lessonId: publishedLesson.id,
        organizationId: organization.id,
        position: 0,
      }),
      activityFixture({
        isPublished: false,
        lessonId: publishedLesson.id,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    await activityProgressFixture({
      activityId: publishedActivity.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: Number(user.id),
    });

    const result = await getCourseChapterCompletion(Number(user.id), course.id);
    // Only the published lesson with the published activity counts
    expect(result).toEqual([{ chapterId: chapter.id, completedLessons: 1, totalLessons: 1 }]);
  });

  test("chapters with 0 published lessons return totalLessons 0", async () => {
    const [user, course] = await Promise.all([
      userFixture(),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    // Chapter with no lessons at all
    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const result = await getCourseChapterCompletion(Number(user.id), course.id);
    expect(result).toEqual([{ chapterId: chapter.id, completedLessons: 0, totalLessons: 0 }]);
  });

  test("lessons with 0 published activities are excluded from total count", async () => {
    const [user, course] = await Promise.all([
      userFixture(),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    // Lesson with no activities
    await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const result = await getCourseChapterCompletion(Number(user.id), course.id);
    // Lesson has no published activities, so it's excluded from totalLessons
    expect(result).toEqual([{ chapterId: chapter.id, completedLessons: 0, totalLessons: 0 }]);
  });
});
