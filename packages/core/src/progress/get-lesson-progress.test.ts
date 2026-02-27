import { activityFixture, activityProgressFixture } from "@zoonk/testing/fixtures/activities";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, test } from "vitest";
import { getLessonProgress } from "./get-lesson-progress";

describe(getLessonProgress, () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;

  beforeAll(async () => {
    organization = await organizationFixture();
  });

  test("returns empty array when unauthenticated", async () => {
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const result = await getLessonProgress({
      chapterId: chapter.id,
      headers: new Headers(),
    });
    expect(result).toEqual([]);
  });

  test("returns empty array when user has no progress and lessons have no activities", async () => {
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

    // Lesson with no activities - excluded from results
    await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const headers = await signInAs(user.email, user.password);
    const result = await getLessonProgress({ chapterId: chapter.id, headers });
    expect(result).toEqual([]);
  });

  test("returns correct completedActivities and totalActivities counts", async () => {
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

    const [activity1, activity2, _activity3] = await Promise.all([
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
      activityFixture({
        isPublished: true,
        lessonId: lesson.id,
        organizationId: organization.id,
        position: 2,
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

    const headers = await signInAs(user.email, user.password);
    const result = await getLessonProgress({ chapterId: chapter.id, headers });
    expect(result).toEqual([{ completedActivities: 2, lessonId: lesson.id, totalActivities: 3 }]);
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

    const headers = await signInAs(user.email, user.password);
    const result = await getLessonProgress({ chapterId: chapter.id, headers });
    expect(result).toEqual([{ completedActivities: 1, lessonId: lesson.id, totalActivities: 2 }]);
  });

  test("only counts published activities", async () => {
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

    const [publishedActivity] = await Promise.all([
      activityFixture({
        isPublished: true,
        lessonId: lesson.id,
        organizationId: organization.id,
        position: 0,
      }),
      activityFixture({
        isPublished: false,
        lessonId: lesson.id,
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

    const headers = await signInAs(user.email, user.password);
    const result = await getLessonProgress({ chapterId: chapter.id, headers });
    expect(result).toEqual([{ completedActivities: 1, lessonId: lesson.id, totalActivities: 1 }]);
  });

  test("lessons with 0 published activities are excluded from results", async () => {
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

    const [lessonWithActivities, lessonWithoutActivities] = await Promise.all([
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

    await activityFixture({
      isPublished: true,
      lessonId: lessonWithActivities.id,
      organizationId: organization.id,
      position: 0,
    });

    const headers = await signInAs(user.email, user.password);
    const result = await getLessonProgress({ chapterId: chapter.id, headers });
    // Only the lesson with activities should appear
    expect(result).toEqual([
      { completedActivities: 0, lessonId: lessonWithActivities.id, totalActivities: 1 },
    ]);
    expect(result.find((row) => row.lessonId === lessonWithoutActivities.id)).toBeUndefined();
  });
});
