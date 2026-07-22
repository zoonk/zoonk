import { type LessonKind } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, it } from "vitest";
import { type LessonProgressInput, getLessonProgress } from "./get-lesson-progress";
import { listPublishedLessonProgressRows } from "./progress-queries";

/**
 * Loads the published row input consumed by the pure lesson selector while
 * keeping scope, identity, and lesson-kind filtering explicit in each case.
 */
async function loadLessonProgressInput({
  chapterId,
  excludedLessonKinds,
  userId,
}: {
  chapterId: string;
  excludedLessonKinds?: LessonKind[];
  userId: string;
}): Promise<LessonProgressInput> {
  const rows = await listPublishedLessonProgressRows({
    excludedLessonKinds,
    scope: { chapterId },
    userId,
  });

  return { rows };
}

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

  it("returns an empty array for an empty published chapter", () => {
    const result = getLessonProgress({ rows: [] });

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

    const input = await loadLessonProgressInput({ chapterId: chapter.id, userId: user.id });
    const result = getLessonProgress(input);

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

    const input = await loadLessonProgressInput({ chapterId: chapter.id, userId: user.id });
    const result = getLessonProgress(input);

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

    const input = await loadLessonProgressInput({ chapterId: chapter.id, userId: user.id });
    const result = getLessonProgress(input);

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

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: visibleLesson.id,
      userId: user.id,
    });

    const input = await loadLessonProgressInput({
      chapterId: chapter.id,
      excludedLessonKinds: ["quiz"],
      userId: user.id,
    });

    const result = getLessonProgress(input);

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

    const input = await loadLessonProgressInput({ chapterId: chapter.id, userId: user.id });
    const result = getLessonProgress(input);

    expect(result).toStrictEqual([
      { isCompleted: true, lessonId: completedLesson.id },
      { isCompleted: false, lessonId: newLesson.id },
    ]);
  });
});
