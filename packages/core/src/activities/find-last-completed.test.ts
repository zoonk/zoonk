import { activityFixture, activityProgressFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, test } from "vitest";
import { findLastCompleted } from "./find-last-completed";

describe(findLastCompleted, () => {
  let orgId: number;
  let userId: number;

  beforeAll(async () => {
    const [org, user] = await Promise.all([organizationFixture({ kind: "brand" }), userFixture()]);
    orgId = org.id;
    userId = Number(user.id);
  });

  test("returns null when user has no completions", async () => {
    const course = await courseFixture({ isPublished: true, organizationId: orgId });
    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: orgId,
      position: 0,
    });
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: orgId,
      position: 0,
    });

    await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      lessonId: lesson.id,
      organizationId: orgId,
      position: 0,
    });

    const result = await findLastCompleted(userId, { courseId: course.id });

    expect(result).toBeNull();
  });

  test("returns null when completedAt is null (started but not finished)", async () => {
    const course = await courseFixture({ isPublished: true, organizationId: orgId });
    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: orgId,
      position: 0,
    });
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: orgId,
      position: 0,
    });

    const activity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      lessonId: lesson.id,
      organizationId: orgId,
      position: 0,
    });

    await activityProgressFixture({
      activityId: activity.id,
      completedAt: null,
      durationSeconds: 60,
      userId,
    });

    const result = await findLastCompleted(userId, { courseId: course.id });

    expect(result).toBeNull();
  });

  test("returns the most recently completed activity", async () => {
    const user = await userFixture();
    const uid = Number(user.id);

    const course = await courseFixture({ isPublished: true, organizationId: orgId });
    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: orgId,
      position: 0,
    });
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: orgId,
      position: 0,
    });

    const [activity1, activity2] = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lesson.id,
        organizationId: orgId,
        position: 0,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lesson.id,
        organizationId: orgId,
        position: 1,
      }),
    ]);

    await Promise.all([
      activityProgressFixture({
        activityId: activity1.id,
        completedAt: new Date("2024-01-01"),
        durationSeconds: 60,
        userId: uid,
      }),
      activityProgressFixture({
        activityId: activity2.id,
        completedAt: new Date("2024-01-02"),
        durationSeconds: 60,
        userId: uid,
      }),
    ]);

    const result = await findLastCompleted(uid, { courseId: course.id });

    expect(result).toMatchObject({
      activityPosition: 1,
      chapterId: chapter.id,
      chapterPosition: 0,
      chapterSlug: chapter.slug,
      courseId: course.id,
      courseSlug: course.slug,
      lessonId: lesson.id,
      lessonPosition: 0,
      lessonSlug: lesson.slug,
    });
    expect(result).toHaveProperty("orgSlug");
  });

  test("tiebreaker: returns furthest activity when completedAt is identical", async () => {
    const user = await userFixture();
    const uid = Number(user.id);

    const course = await courseFixture({ isPublished: true, organizationId: orgId });
    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: orgId,
      position: 0,
    });
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: orgId,
      position: 0,
    });

    const [activity1, activity2] = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lesson.id,
        organizationId: orgId,
        position: 0,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lesson.id,
        organizationId: orgId,
        position: 1,
      }),
    ]);

    const sameTimestamp = new Date("2024-06-15T12:00:00Z");

    await Promise.all([
      activityProgressFixture({
        activityId: activity1.id,
        completedAt: sameTimestamp,
        durationSeconds: 60,
        userId: uid,
      }),
      activityProgressFixture({
        activityId: activity2.id,
        completedAt: sameTimestamp,
        durationSeconds: 60,
        userId: uid,
      }),
    ]);

    const result = await findLastCompleted(uid, { courseId: course.id });

    expect(result).toMatchObject({ activityPosition: 1 });
  });

  describe("course scope", () => {
    test("finds completions across chapters", async () => {
      const user = await userFixture();
      const uid = Number(user.id);

      const course = await courseFixture({ isPublished: true, organizationId: orgId });

      const [ch1, ch2] = await Promise.all([
        chapterFixture({
          courseId: course.id,
          isPublished: true,
          organizationId: orgId,
          position: 0,
        }),
        chapterFixture({
          courseId: course.id,
          isPublished: true,
          organizationId: orgId,
          position: 1,
        }),
      ]);

      const [lesson1, lesson2] = await Promise.all([
        lessonFixture({
          chapterId: ch1.id,
          isPublished: true,
          organizationId: orgId,
          position: 0,
        }),
        lessonFixture({
          chapterId: ch2.id,
          isPublished: true,
          organizationId: orgId,
          position: 0,
        }),
      ]);

      const [activity1, activity2] = await Promise.all([
        activityFixture({
          generationStatus: "completed",
          isPublished: true,
          lessonId: lesson1.id,
          organizationId: orgId,
          position: 0,
        }),
        activityFixture({
          generationStatus: "completed",
          isPublished: true,
          lessonId: lesson2.id,
          organizationId: orgId,
          position: 0,
        }),
      ]);

      await Promise.all([
        activityProgressFixture({
          activityId: activity1.id,
          completedAt: new Date("2024-01-01"),
          durationSeconds: 60,
          userId: uid,
        }),
        activityProgressFixture({
          activityId: activity2.id,
          completedAt: new Date("2024-01-02"),
          durationSeconds: 60,
          userId: uid,
        }),
      ]);

      const result = await findLastCompleted(uid, { courseId: course.id });

      expect(result).toMatchObject({
        chapterId: ch2.id,
        chapterPosition: 1,
        lessonId: lesson2.id,
      });
    });

    test("ignores completions from other courses", async () => {
      const user = await userFixture();
      const uid = Number(user.id);

      const [course1, course2] = await Promise.all([
        courseFixture({ isPublished: true, organizationId: orgId }),
        courseFixture({ isPublished: true, organizationId: orgId }),
      ]);

      const [ch1, ch2] = await Promise.all([
        chapterFixture({
          courseId: course1.id,
          isPublished: true,
          organizationId: orgId,
          position: 0,
        }),
        chapterFixture({
          courseId: course2.id,
          isPublished: true,
          organizationId: orgId,
          position: 0,
        }),
      ]);

      const [lesson1, lesson2] = await Promise.all([
        lessonFixture({
          chapterId: ch1.id,
          isPublished: true,
          organizationId: orgId,
          position: 0,
        }),
        lessonFixture({
          chapterId: ch2.id,
          isPublished: true,
          organizationId: orgId,
          position: 0,
        }),
      ]);

      const [activity1, activity2] = await Promise.all([
        activityFixture({
          generationStatus: "completed",
          isPublished: true,
          lessonId: lesson1.id,
          organizationId: orgId,
          position: 0,
        }),
        activityFixture({
          generationStatus: "completed",
          isPublished: true,
          lessonId: lesson2.id,
          organizationId: orgId,
          position: 0,
        }),
      ]);

      await Promise.all([
        activityProgressFixture({
          activityId: activity1.id,
          completedAt: new Date("2024-01-01"),
          durationSeconds: 60,
          userId: uid,
        }),
        activityProgressFixture({
          activityId: activity2.id,
          completedAt: new Date("2024-01-02"),
          durationSeconds: 60,
          userId: uid,
        }),
      ]);

      const result = await findLastCompleted(uid, { courseId: course1.id });

      expect(result).toMatchObject({
        courseId: course1.id,
        lessonId: lesson1.id,
      });
    });
  });

  describe("chapter scope", () => {
    test("finds completions only within the given chapter", async () => {
      const user = await userFixture();
      const uid = Number(user.id);

      const course = await courseFixture({ isPublished: true, organizationId: orgId });

      const [ch1, ch2] = await Promise.all([
        chapterFixture({
          courseId: course.id,
          isPublished: true,
          organizationId: orgId,
          position: 0,
        }),
        chapterFixture({
          courseId: course.id,
          isPublished: true,
          organizationId: orgId,
          position: 1,
        }),
      ]);

      const [lesson1, lesson2] = await Promise.all([
        lessonFixture({
          chapterId: ch1.id,
          isPublished: true,
          organizationId: orgId,
          position: 0,
        }),
        lessonFixture({
          chapterId: ch2.id,
          isPublished: true,
          organizationId: orgId,
          position: 0,
        }),
      ]);

      const [activity1, activity2] = await Promise.all([
        activityFixture({
          generationStatus: "completed",
          isPublished: true,
          lessonId: lesson1.id,
          organizationId: orgId,
          position: 0,
        }),
        activityFixture({
          generationStatus: "completed",
          isPublished: true,
          lessonId: lesson2.id,
          organizationId: orgId,
          position: 0,
        }),
      ]);

      await Promise.all([
        activityProgressFixture({
          activityId: activity1.id,
          completedAt: new Date("2024-01-01"),
          durationSeconds: 60,
          userId: uid,
        }),
        activityProgressFixture({
          activityId: activity2.id,
          completedAt: new Date("2024-01-02"),
          durationSeconds: 60,
          userId: uid,
        }),
      ]);

      const result = await findLastCompleted(uid, { chapterId: ch1.id });

      expect(result).toMatchObject({
        chapterId: ch1.id,
        lessonId: lesson1.id,
      });
    });
  });

  describe("lesson scope", () => {
    test("finds completions only within the given lesson", async () => {
      const user = await userFixture();
      const uid = Number(user.id);

      const course = await courseFixture({ isPublished: true, organizationId: orgId });
      const chapter = await chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: orgId,
        position: 0,
      });

      const [lesson1, lesson2] = await Promise.all([
        lessonFixture({
          chapterId: chapter.id,
          isPublished: true,
          organizationId: orgId,
          position: 0,
        }),
        lessonFixture({
          chapterId: chapter.id,
          isPublished: true,
          organizationId: orgId,
          position: 1,
        }),
      ]);

      const [activity1, activity2] = await Promise.all([
        activityFixture({
          generationStatus: "completed",
          isPublished: true,
          lessonId: lesson1.id,
          organizationId: orgId,
          position: 0,
        }),
        activityFixture({
          generationStatus: "completed",
          isPublished: true,
          lessonId: lesson2.id,
          organizationId: orgId,
          position: 0,
        }),
      ]);

      await Promise.all([
        activityProgressFixture({
          activityId: activity1.id,
          completedAt: new Date("2024-01-01"),
          durationSeconds: 60,
          userId: uid,
        }),
        activityProgressFixture({
          activityId: activity2.id,
          completedAt: new Date("2024-01-02"),
          durationSeconds: 60,
          userId: uid,
        }),
      ]);

      const result = await findLastCompleted(uid, { lessonId: lesson1.id });

      expect(result).toMatchObject({
        lessonId: lesson1.id,
        activityPosition: 0,
      });
    });
  });

  test("skips completions for unpublished activities", async () => {
    const user = await userFixture();
    const uid = Number(user.id);

    const course = await courseFixture({ isPublished: true, organizationId: orgId });
    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: orgId,
      position: 0,
    });
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: orgId,
      position: 0,
    });

    const [publishedActivity, unpublishedActivity] = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lesson.id,
        organizationId: orgId,
        position: 0,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: false,
        lessonId: lesson.id,
        organizationId: orgId,
        position: 1,
      }),
    ]);

    await Promise.all([
      activityProgressFixture({
        activityId: publishedActivity.id,
        completedAt: new Date("2024-01-01"),
        durationSeconds: 60,
        userId: uid,
      }),
      activityProgressFixture({
        activityId: unpublishedActivity.id,
        completedAt: new Date("2024-01-02"),
        durationSeconds: 60,
        userId: uid,
      }),
    ]);

    const result = await findLastCompleted(uid, { courseId: course.id });

    expect(result).toMatchObject({ activityPosition: 0 });
  });

  test("skips completions in unpublished lessons", async () => {
    const user = await userFixture();
    const uid = Number(user.id);

    const course = await courseFixture({ isPublished: true, organizationId: orgId });
    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: orgId,
      position: 0,
    });

    const [publishedLesson, unpublishedLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId: orgId,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        isPublished: false,
        organizationId: orgId,
        position: 1,
      }),
    ]);

    const [activity1, activity2] = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: publishedLesson.id,
        organizationId: orgId,
        position: 0,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: unpublishedLesson.id,
        organizationId: orgId,
        position: 0,
      }),
    ]);

    await Promise.all([
      activityProgressFixture({
        activityId: activity1.id,
        completedAt: new Date("2024-01-01"),
        durationSeconds: 60,
        userId: uid,
      }),
      activityProgressFixture({
        activityId: activity2.id,
        completedAt: new Date("2024-01-02"),
        durationSeconds: 60,
        userId: uid,
      }),
    ]);

    const result = await findLastCompleted(uid, { courseId: course.id });

    expect(result).toMatchObject({
      lessonId: publishedLesson.id,
      lessonPosition: 0,
    });
  });

  test("skips completions in unpublished chapters", async () => {
    const user = await userFixture();
    const uid = Number(user.id);

    const course = await courseFixture({ isPublished: true, organizationId: orgId });

    const [publishedChapter, unpublishedChapter] = await Promise.all([
      chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: orgId,
        position: 0,
      }),
      chapterFixture({
        courseId: course.id,
        isPublished: false,
        organizationId: orgId,
        position: 1,
      }),
    ]);

    const [lesson1, lesson2] = await Promise.all([
      lessonFixture({
        chapterId: publishedChapter.id,
        isPublished: true,
        organizationId: orgId,
        position: 0,
      }),
      lessonFixture({
        chapterId: unpublishedChapter.id,
        isPublished: true,
        organizationId: orgId,
        position: 0,
      }),
    ]);

    const [activity1, activity2] = await Promise.all([
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lesson1.id,
        organizationId: orgId,
        position: 0,
      }),
      activityFixture({
        generationStatus: "completed",
        isPublished: true,
        lessonId: lesson2.id,
        organizationId: orgId,
        position: 0,
      }),
    ]);

    await Promise.all([
      activityProgressFixture({
        activityId: activity1.id,
        completedAt: new Date("2024-01-01"),
        durationSeconds: 60,
        userId: uid,
      }),
      activityProgressFixture({
        activityId: activity2.id,
        completedAt: new Date("2024-01-02"),
        durationSeconds: 60,
        userId: uid,
      }),
    ]);

    const result = await findLastCompleted(uid, { courseId: course.id });

    expect(result).toMatchObject({
      chapterId: publishedChapter.id,
      chapterPosition: 0,
    });
  });

  test("returns null for non-existent course", async () => {
    const result = await findLastCompleted(userId, { courseId: 999_999 });

    expect(result).toBeNull();
  });

  test("ignores other users' completions", async () => {
    const [user1, user2] = await Promise.all([userFixture(), userFixture()]);

    const course = await courseFixture({ isPublished: true, organizationId: orgId });
    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: orgId,
      position: 0,
    });
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: orgId,
      position: 0,
    });

    const activity = await activityFixture({
      generationStatus: "completed",
      isPublished: true,
      lessonId: lesson.id,
      organizationId: orgId,
      position: 0,
    });

    await activityProgressFixture({
      activityId: activity.id,
      completedAt: new Date(),
      durationSeconds: 60,
      userId: Number(user2.id),
    });

    const result = await findLastCompleted(Number(user1.id), { courseId: course.id });

    expect(result).toBeNull();
  });
});
