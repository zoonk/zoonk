import { activityFixture, activityProgressFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, test } from "vitest";
import { getLessonActivityCompletion } from "./get-lesson-activity-completion";

describe(getLessonActivityCompletion, () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;

  beforeAll(async () => {
    organization = await organizationFixture();
  });

  test("returns empty array when userId is 0", async () => {
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
      isPublished: true,
      lessonId: lesson.id,
      organizationId: organization.id,
      position: 0,
    });

    const result = await getLessonActivityCompletion(0, lesson.id);
    expect(result).toEqual([]);
  });

  test("returns empty array when user has no progress", async () => {
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

    const result = await getLessonActivityCompletion(Number(user.id), lesson.id);
    expect(result).toEqual([]);
  });

  test("returns completed activity IDs", async () => {
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

    await Promise.all([
      activityProgressFixture({
        activityId: activity1.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: Number(user.id),
      }),
      activityProgressFixture({
        activityId: activity2.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: Number(user.id),
      }),
    ]);

    const result = await getLessonActivityCompletion(Number(user.id), lesson.id);
    expect(result).toEqual(expect.arrayContaining([String(activity1.id), String(activity2.id)]));
    expect(result).toHaveLength(2);
  });

  test("excludes started-but-not-completed activities", async () => {
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

    const [completedActivity, startedActivity] = await Promise.all([
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

    await Promise.all([
      activityProgressFixture({
        activityId: completedActivity.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: Number(user.id),
      }),
      activityProgressFixture({
        activityId: startedActivity.id,
        completedAt: null,
        durationSeconds: 30,
        userId: Number(user.id),
      }),
    ]);

    const result = await getLessonActivityCompletion(Number(user.id), lesson.id);
    expect(result).toEqual([String(completedActivity.id)]);
  });

  test("only returns activities for the specified lesson", async () => {
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

    const [lesson1, lesson2] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    const [activityInLesson1, activityInLesson2] = await Promise.all([
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

    await Promise.all([
      activityProgressFixture({
        activityId: activityInLesson1.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: Number(user.id),
      }),
      activityProgressFixture({
        activityId: activityInLesson2.id,
        completedAt: new Date(),
        durationSeconds: 60,
        userId: Number(user.id),
      }),
    ]);

    const result = await getLessonActivityCompletion(Number(user.id), lesson1.id);
    expect(result).toEqual([String(activityInLesson1.id)]);
  });
});
