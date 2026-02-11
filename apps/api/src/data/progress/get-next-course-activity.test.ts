import { activityFixture, activityProgressFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture, courseUserFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, test } from "vitest";
import { getNextCourseActivity } from "./get-next-course-activity";

describe(getNextCourseActivity, () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;

  beforeAll(async () => {
    organization = await organizationFixture();
  });
  test("returns first activity when userId is 0 (unauthenticated)", async () => {
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });
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

    const result = await getNextCourseActivity(0, course.id);

    expect(result).toEqual({
      activityPosition: activity.position,
      brandSlug: organization.slug,
      chapterSlug: chapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: false,
      lessonSlug: lesson.slug,
    });
  });

  test("returns first activity when user has not started", async () => {
    const user = await userFixture();
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });
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

    const result = await getNextCourseActivity(Number(user.id), course.id);

    expect(result).toEqual({
      activityPosition: activity.position,
      brandSlug: organization.slug,
      chapterSlug: chapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: false,
      lessonSlug: lesson.slug,
    });
  });

  test("returns next incomplete activity when user has progress", async () => {
    const user = await userFixture();
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });
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

    const activity1 = await activityFixture({
      isPublished: true,
      lessonId: lesson.id,
      organizationId: organization.id,
      position: 0,
    });
    const activity2 = await activityFixture({
      isPublished: true,
      lessonId: lesson.id,
      organizationId: organization.id,
      position: 1,
    });
    await activityFixture({
      isPublished: true,
      lessonId: lesson.id,
      organizationId: organization.id,
      position: 2,
    });

    await courseUserFixture({ courseId: course.id, userId: Number(user.id) });
    await activityProgressFixture({
      activityId: activity1.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: Number(user.id),
    });

    const result = await getNextCourseActivity(Number(user.id), course.id);

    expect(result).toEqual({
      activityPosition: activity2.position,
      brandSlug: organization.slug,
      chapterSlug: chapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: true,
      lessonSlug: lesson.slug,
    });
  });

  test("returns first activity with completed=true when all completed", async () => {
    const user = await userFixture();
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });
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

    const activity1 = await activityFixture({
      isPublished: true,
      lessonId: lesson.id,
      organizationId: organization.id,
      position: 0,
    });
    const activity2 = await activityFixture({
      isPublished: true,
      lessonId: lesson.id,
      organizationId: organization.id,
      position: 1,
    });

    await courseUserFixture({ courseId: course.id, userId: Number(user.id) });
    await activityProgressFixture({
      activityId: activity1.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: Number(user.id),
    });
    await activityProgressFixture({
      activityId: activity2.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: Number(user.id),
    });

    const result = await getNextCourseActivity(Number(user.id), course.id);

    expect(result).toEqual({
      activityPosition: activity1.position,
      brandSlug: organization.slug,
      chapterSlug: chapter.slug,
      completed: true,
      courseSlug: course.slug,
      hasStarted: true,
      lessonSlug: lesson.slug,
    });
  });

  test("returns null when no published activities exist", async () => {
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });
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
      isPublished: false,
      lessonId: lesson.id,
      organizationId: organization.id,
      position: 0,
    });

    const result = await getNextCourseActivity(0, course.id);

    expect(result).toBeNull();
  });

  test("respects position ordering across chapters", async () => {
    const user = await userFixture();
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const chapter1 = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });
    const chapter2 = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 1,
    });

    const lesson1 = await lessonFixture({
      chapterId: chapter1.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });
    const lesson2 = await lessonFixture({
      chapterId: chapter2.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const activity1 = await activityFixture({
      isPublished: true,
      lessonId: lesson1.id,
      organizationId: organization.id,
      position: 0,
    });
    const activity2 = await activityFixture({
      isPublished: true,
      lessonId: lesson2.id,
      organizationId: organization.id,
      position: 0,
    });

    await courseUserFixture({ courseId: course.id, userId: Number(user.id) });
    await activityProgressFixture({
      activityId: activity1.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: Number(user.id),
    });

    const result = await getNextCourseActivity(Number(user.id), course.id);

    expect(result).toEqual({
      activityPosition: activity2.position,
      brandSlug: organization.slug,
      chapterSlug: chapter2.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: true,
      lessonSlug: lesson2.slug,
    });
  });

  test("skips unpublished chapters", async () => {
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const unpublishedChapter = await chapterFixture({
      courseId: course.id,
      isPublished: false,
      organizationId: organization.id,
      position: 0,
    });
    const publishedChapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 1,
    });

    const unpublishedLesson = await lessonFixture({
      chapterId: unpublishedChapter.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });
    const publishedLesson = await lessonFixture({
      chapterId: publishedChapter.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    await activityFixture({
      isPublished: true,
      lessonId: unpublishedLesson.id,
      organizationId: organization.id,
      position: 0,
    });
    const publishedActivity = await activityFixture({
      isPublished: true,
      lessonId: publishedLesson.id,
      organizationId: organization.id,
      position: 0,
    });

    const result = await getNextCourseActivity(0, course.id);

    expect(result).toEqual({
      activityPosition: publishedActivity.position,
      brandSlug: organization.slug,
      chapterSlug: publishedChapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: false,
      lessonSlug: publishedLesson.slug,
    });
  });
});
