import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, it } from "vitest";
import { getLessonProgress } from "./get-lesson-progress";

describe(getLessonProgress, () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;

  beforeAll(async () => {
    organization = await organizationFixture();
  });

  async function createPublishedChapter() {
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    return chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });
  }

  it("returns empty array when unauthenticated", async () => {
    const chapter = await createPublishedChapter();

    const result = await getLessonProgress({ chapterId: chapter.id, headers: new Headers() });

    expect(result).toStrictEqual([]);
  });

  it("returns completion rows for published lessons in the chapter", async () => {
    const [user, chapter] = await Promise.all([userFixture(), createPublishedChapter()]);

    const [completedLesson, pendingLesson] = await Promise.all([
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

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: completedLesson.id,
      userId: user.id,
    });

    const headers = await signInAs(user.email, user.password);
    const result = await getLessonProgress({ chapterId: chapter.id, headers });

    expect(result).toStrictEqual([
      { isCompleted: true, lessonId: completedLesson.id },
      { isCompleted: false, lessonId: pendingLesson.id },
    ]);
  });

  it("excludes started-but-not-completed lessons", async () => {
    const [user, chapter] = await Promise.all([userFixture(), createPublishedChapter()]);

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    await lessonProgressFixture({
      completedAt: null,
      durationSeconds: 30,
      lessonId: lesson.id,
      userId: user.id,
    });

    const headers = await signInAs(user.email, user.password);
    const result = await getLessonProgress({ chapterId: chapter.id, headers });

    expect(result).toStrictEqual([{ isCompleted: false, lessonId: lesson.id }]);
  });

  it("excludes unpublished lessons", async () => {
    const [user, chapter] = await Promise.all([userFixture(), createPublishedChapter()]);

    const [publishedLesson, unpublishedLesson] = await Promise.all([
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

    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: publishedLesson.id,
        userId: user.id,
      }),
      lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: unpublishedLesson.id,
        userId: user.id,
      }),
    ]);

    const headers = await signInAs(user.email, user.password);
    const result = await getLessonProgress({ chapterId: chapter.id, headers });

    expect(result).toStrictEqual([{ isCompleted: true, lessonId: publishedLesson.id }]);
  });

  it("excludes hidden lesson kinds from progress rows", async () => {
    const [user, chapter] = await Promise.all([userFixture(), createPublishedChapter()]);

    const [visibleLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        kind: "explanation",
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        kind: "quiz",
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    const [headers] = await Promise.all([
      signInAs(user.email, user.password),
      lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: visibleLesson.id,
        userId: user.id,
      }),
    ]);

    const result = await getLessonProgress({
      chapterId: chapter.id,
      excludedLessonKinds: ["quiz"],
      headers,
    });

    expect(result).toStrictEqual([{ isCompleted: true, lessonId: visibleLesson.id }]);
  });

  it("keeps a completed lesson completed when a new lesson is added later", async () => {
    const [user, chapter] = await Promise.all([userFixture(), createPublishedChapter()]);

    const completedLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: completedLesson.id,
      userId: user.id,
    });

    const newLesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: organization.id,
      position: 1,
    });

    const headers = await signInAs(user.email, user.password);
    const result = await getLessonProgress({ chapterId: chapter.id, headers });

    expect(result).toStrictEqual([
      { isCompleted: true, lessonId: completedLesson.id },
      { isCompleted: false, lessonId: newLesson.id },
    ]);
  });
});
