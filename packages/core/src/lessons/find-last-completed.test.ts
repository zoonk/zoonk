import { randomUUID } from "node:crypto";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, it } from "vitest";
import { findLastCompleted } from "./find-last-completed";

describe(findLastCompleted, () => {
  let orgId: string;
  let userId: string;

  beforeAll(async () => {
    const [org, user] = await Promise.all([organizationFixture({ kind: "brand" }), userFixture()]);
    orgId = org.id;
    userId = user.id;
  });

  it("returns null when user has no completions", async () => {
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

    await lessonFixture({
      generationStatus: "completed",
      isPublished: true,
      lessonId: lesson.id,
      organizationId: orgId,
      position: 0,
    });

    const result = await findLastCompleted(userId, { courseId: course.id });

    expect(result).toBeNull();
  });

  it("returns null when completedAt is null (started but not finished)", async () => {
    const course = await courseFixture({ isPublished: true, organizationId: orgId });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: orgId,
      position: 0,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      organizationId: orgId,
      position: 0,
    });

    await lessonProgressFixture({
      completedAt: null,
      durationSeconds: 60,
      lessonId: lesson.id,
      userId,
    });

    const result = await findLastCompleted(userId, { courseId: course.id });

    expect(result).toBeNull();
  });

  it("returns the furthest completed lesson in course order", async () => {
    const user = await userFixture();
    const uid = user.id;

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
        generationStatus: "completed",
        isPublished: true,
        organizationId: orgId,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: orgId,
        position: 1,
      }),
    ]);

    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date("2024-01-01"),
        durationSeconds: 60,
        lessonId: lesson1.id,
        userId: uid,
      }),
      lessonProgressFixture({
        completedAt: new Date("2024-01-02"),
        durationSeconds: 60,
        lessonId: lesson2.id,
        userId: uid,
      }),
    ]);

    const result = await findLastCompleted(uid, { courseId: course.id });

    expect(result).toMatchObject({
      chapterId: chapter.id,
      chapterPosition: 0,
      chapterSlug: chapter.slug,
      courseId: course.id,
      courseSlug: course.slug,
      lessonId: lesson2.id,
      lessonPosition: 1,
      lessonSlug: lesson2.slug,
    });

    expect(result).toHaveProperty("orgSlug");
  });

  it("keeps the furthest completion when an earlier lesson was reviewed later", async () => {
    const user = await userFixture();
    const uid = user.id;

    const course = await courseFixture({ isPublished: true, organizationId: orgId });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: orgId,
      position: 0,
    });

    const [reviewedLesson, furthestLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: orgId,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: orgId,
        position: 1,
      }),
    ]);

    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date("2024-01-03"),
        durationSeconds: 60,
        lessonId: reviewedLesson.id,
        userId: uid,
      }),
      lessonProgressFixture({
        completedAt: new Date("2024-01-02"),
        durationSeconds: 60,
        lessonId: furthestLesson.id,
        userId: uid,
      }),
    ]);

    const result = await findLastCompleted(uid, { courseId: course.id });

    expect(result).toMatchObject({ lessonId: furthestLesson.id, lessonPosition: 1 });
  });

  it("ignores completed excluded lesson kinds when choosing the furthest completion", async () => {
    const [user, course] = await Promise.all([
      userFixture(),
      courseFixture({ isPublished: true, organizationId: orgId }),
    ]);

    const uid = user.id;

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: orgId,
      position: 0,
    });

    const [visibleLesson, hiddenCompletedLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "explanation",
        organizationId: orgId,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "quiz",
        organizationId: orgId,
        position: 1,
      }),
    ]);

    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date("2024-01-01"),
        durationSeconds: 60,
        lessonId: visibleLesson.id,
        userId: uid,
      }),
      lessonProgressFixture({
        completedAt: new Date("2024-01-02"),
        durationSeconds: 60,
        lessonId: hiddenCompletedLesson.id,
        userId: uid,
      }),
    ]);

    const result = await findLastCompleted(
      uid,
      { courseId: course.id },
      { excludedLessonKinds: ["quiz"] },
    );

    expect(result).toMatchObject({ lessonId: visibleLesson.id, lessonPosition: 0 });
    expect(result).not.toMatchObject({ lessonId: hiddenCompletedLesson.id });
  });

  it("tiebreaker: returns furthest lesson when completedAt is identical", async () => {
    const user = await userFixture();
    const uid = user.id;

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
        generationStatus: "completed",
        isPublished: true,
        organizationId: orgId,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: orgId,
        position: 1,
      }),
    ]);

    const sameTimestamp = new Date("2024-06-15T12:00:00Z");

    await Promise.all([
      lessonProgressFixture({
        completedAt: sameTimestamp,
        durationSeconds: 60,
        lessonId: lesson1.id,
        userId: uid,
      }),
      lessonProgressFixture({
        completedAt: sameTimestamp,
        durationSeconds: 60,
        lessonId: lesson2.id,
        userId: uid,
      }),
    ]);

    const result = await findLastCompleted(uid, { courseId: course.id });

    expect(result).toMatchObject({ lessonPosition: 1 });
  });

  describe("course scope", () => {
    it("finds completions across chapters", async () => {
      const user = await userFixture();
      const uid = user.id;

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
          generationStatus: "completed",
          isPublished: true,
          organizationId: orgId,
          position: 0,
        }),
        lessonFixture({
          chapterId: ch2.id,
          generationStatus: "completed",
          isPublished: true,
          organizationId: orgId,
          position: 0,
        }),
      ]);

      await Promise.all([
        lessonProgressFixture({
          completedAt: new Date("2024-01-01"),
          durationSeconds: 60,
          lessonId: lesson1.id,
          userId: uid,
        }),
        lessonProgressFixture({
          completedAt: new Date("2024-01-02"),
          durationSeconds: 60,
          lessonId: lesson2.id,
          userId: uid,
        }),
      ]);

      const result = await findLastCompleted(uid, { courseId: course.id });

      expect(result).toMatchObject({ chapterId: ch2.id, chapterPosition: 1, lessonId: lesson2.id });
    });

    it("ignores completions from other courses", async () => {
      const user = await userFixture();
      const uid = user.id;

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
          generationStatus: "completed",
          isPublished: true,
          organizationId: orgId,
          position: 0,
        }),
        lessonFixture({
          chapterId: ch2.id,
          generationStatus: "completed",
          isPublished: true,
          organizationId: orgId,
          position: 0,
        }),
      ]);

      await Promise.all([
        lessonProgressFixture({
          completedAt: new Date("2024-01-01"),
          durationSeconds: 60,
          lessonId: lesson1.id,
          userId: uid,
        }),
        lessonProgressFixture({
          completedAt: new Date("2024-01-02"),
          durationSeconds: 60,
          lessonId: lesson2.id,
          userId: uid,
        }),
      ]);

      const result = await findLastCompleted(uid, { courseId: course1.id });

      expect(result).toMatchObject({ courseId: course1.id, lessonId: lesson1.id });
    });
  });

  describe("chapter scope", () => {
    it("finds completions only within the given chapter", async () => {
      const user = await userFixture();
      const uid = user.id;

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
          generationStatus: "completed",
          isPublished: true,
          organizationId: orgId,
          position: 0,
        }),
        lessonFixture({
          chapterId: ch2.id,
          generationStatus: "completed",
          isPublished: true,
          organizationId: orgId,
          position: 0,
        }),
      ]);

      await Promise.all([
        lessonProgressFixture({
          completedAt: new Date("2024-01-01"),
          durationSeconds: 60,
          lessonId: lesson1.id,
          userId: uid,
        }),
        lessonProgressFixture({
          completedAt: new Date("2024-01-02"),
          durationSeconds: 60,
          lessonId: lesson2.id,
          userId: uid,
        }),
      ]);

      const result = await findLastCompleted(uid, { chapterId: ch1.id });

      expect(result).toMatchObject({ chapterId: ch1.id, lessonId: lesson1.id });
    });
  });

  describe("lesson scope", () => {
    it("finds completions only within the given lesson", async () => {
      const user = await userFixture();
      const uid = user.id;

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
          generationStatus: "completed",
          isPublished: true,
          organizationId: orgId,
          position: 0,
        }),
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "completed",
          isPublished: true,
          organizationId: orgId,
          position: 1,
        }),
      ]);

      await Promise.all([
        lessonProgressFixture({
          completedAt: new Date("2024-01-01"),
          durationSeconds: 60,
          lessonId: lesson1.id,
          userId: uid,
        }),
        lessonProgressFixture({
          completedAt: new Date("2024-01-02"),
          durationSeconds: 60,
          lessonId: lesson2.id,
          userId: uid,
        }),
      ]);

      const result = await findLastCompleted(uid, { lessonId: lesson1.id });

      expect(result).toMatchObject({ lessonId: lesson1.id, lessonPosition: 0 });
    });
  });

  it("skips completions for unpublished lessons", async () => {
    const user = await userFixture();
    const uid = user.id;

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
        generationStatus: "completed",
        isPublished: true,
        organizationId: orgId,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: false,
        organizationId: orgId,
        position: 1,
      }),
    ]);

    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date("2024-01-01"),
        durationSeconds: 60,
        lessonId: publishedLesson.id,
        userId: uid,
      }),
      lessonProgressFixture({
        completedAt: new Date("2024-01-02"),
        durationSeconds: 60,
        lessonId: unpublishedLesson.id,
        userId: uid,
      }),
    ]);

    const result = await findLastCompleted(uid, { courseId: course.id });

    expect(result).toMatchObject({ lessonPosition: 0 });
  });

  it("skips completions in unpublished lessons", async () => {
    const user = await userFixture();
    const uid = user.id;

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

    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date("2024-01-01"),
        durationSeconds: 60,
        lessonId: publishedLesson.id,
        userId: uid,
      }),
      lessonProgressFixture({
        completedAt: new Date("2024-01-02"),
        durationSeconds: 60,
        lessonId: unpublishedLesson.id,
        userId: uid,
      }),
    ]);

    const result = await findLastCompleted(uid, { courseId: course.id });

    expect(result).toMatchObject({ lessonId: publishedLesson.id, lessonPosition: 0 });
  });

  it("skips completions in unpublished chapters", async () => {
    const user = await userFixture();
    const uid = user.id;

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
        generationStatus: "completed",
        isPublished: true,
        organizationId: orgId,
        position: 0,
      }),
      lessonFixture({
        chapterId: unpublishedChapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: orgId,
        position: 0,
      }),
    ]);

    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date("2024-01-01"),
        durationSeconds: 60,
        lessonId: lesson1.id,
        userId: uid,
      }),
      lessonProgressFixture({
        completedAt: new Date("2024-01-02"),
        durationSeconds: 60,
        lessonId: lesson2.id,
        userId: uid,
      }),
    ]);

    const result = await findLastCompleted(uid, { courseId: course.id });

    expect(result).toMatchObject({ chapterId: publishedChapter.id, chapterPosition: 0 });
  });

  it("returns null for non-existent course", async () => {
    const result = await findLastCompleted(userId, { courseId: randomUUID() });

    expect(result).toBeNull();
  });

  it("ignores other users' completions", async () => {
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
      generationStatus: "completed",
      isPublished: true,
      organizationId: orgId,
      position: 0,
    });

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: lesson.id,
      userId: user2.id,
    });

    const result = await findLastCompleted(user1.id, { courseId: course.id });

    expect(result).toBeNull();
  });
});
