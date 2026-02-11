import { activityFixture, activityProgressFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, test } from "vitest";
import { getNextLessonActivity } from "./get-next-lesson-activity";

describe(getNextLessonActivity, () => {
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

    const result = await getNextLessonActivity(0, lesson.id);

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

    const result = await getNextLessonActivity(Number(user.id), lesson.id);

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

    await activityProgressFixture({
      activityId: activity1.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: Number(user.id),
    });

    const result = await getNextLessonActivity(Number(user.id), lesson.id);

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

    const result = await getNextLessonActivity(Number(user.id), lesson.id);

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

    const result = await getNextLessonActivity(0, lesson.id);

    expect(result).toBeNull();
  });

  test("respects position ordering across activities", async () => {
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

    await activityProgressFixture({
      activityId: activity1.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: Number(user.id),
    });

    const result = await getNextLessonActivity(Number(user.id), lesson.id);

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

  test("skips unpublished activities", async () => {
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
    const publishedActivity = await activityFixture({
      isPublished: true,
      lessonId: lesson.id,
      organizationId: organization.id,
      position: 1,
    });

    const result = await getNextLessonActivity(0, lesson.id);

    expect(result).toEqual({
      activityPosition: publishedActivity.position,
      brandSlug: organization.slug,
      chapterSlug: chapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: false,
      lessonSlug: lesson.slug,
    });
  });
});
