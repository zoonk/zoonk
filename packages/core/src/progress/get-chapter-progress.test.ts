import { type LessonKind, prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, it } from "vitest";
import { type ChapterProgressInput, getChapterProgress } from "./get-chapter-progress";
import {
  listDurableChapterCompletionIds,
  listPublishedCourseChapters,
  listPublishedLessonProgressRows,
} from "./progress-queries";

/**
 * Loads the explicit async inputs consumed by the pure chapter selector so
 * integration cases exercise the same parallel read pipeline as the apps.
 */
async function loadChapterProgressInput({
  courseId,
  excludedLessonKinds,
  userId,
}: {
  courseId: string;
  excludedLessonKinds?: LessonKind[];
  userId: string;
}): Promise<ChapterProgressInput> {
  const scope = { courseId };

  const [chapters, durableChapterCompletionIds, rows] = await Promise.all([
    listPublishedCourseChapters({ courseId }),
    listDurableChapterCompletionIds({ excludedLessonKinds, scope, userId }),
    listPublishedLessonProgressRows({ excludedLessonKinds, scope, userId }),
  ]);

  return { chapters, durableChapterCompletionIds, rows };
}

describe(getChapterProgress, () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;

  beforeAll(async () => {
    organization = await organizationFixture();
  });

  it("returns an empty array for an empty published course", () => {
    const result = getChapterProgress({ chapters: [], durableChapterCompletionIds: [], rows: [] });

    expect(result).toStrictEqual([]);
  });

  it("returns chapters with zero counts when user has no progress", async () => {
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

    await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const input = await loadChapterProgressInput({ courseId: course.id, userId: user.id });
    const result = getChapterProgress(input);
    expect(result).toStrictEqual([{ chapterId: chapter.id, completedLessons: 0, totalLessons: 1 }]);
  });

  it("counts completed lessons directly", async () => {
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

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: lesson1.id,
      userId: user.id,
    });

    const input = await loadChapterProgressInput({ courseId: course.id, userId: user.id });
    const result = getChapterProgress(input);
    expect(result).toStrictEqual([{ chapterId: chapter.id, completedLessons: 1, totalLessons: 2 }]);

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: lesson2.id,
      userId: user.id,
    });

    const updatedInput = await loadChapterProgressInput({ courseId: course.id, userId: user.id });
    const result2 = getChapterProgress(updatedInput);

    expect(result2).toStrictEqual([
      { chapterId: chapter.id, completedLessons: 2, totalLessons: 2 },
    ]);
  });

  it("returns correct counts across multiple chapters", async () => {
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

    const [lesson1, _lesson2] = await Promise.all([
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

    // Complete only the first chapter's lesson
    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: lesson1.id,
      userId: user.id,
    });

    const input = await loadChapterProgressInput({ courseId: course.id, userId: user.id });
    const result = getChapterProgress(input);

    expect(result).toStrictEqual([
      { chapterId: chapter1.id, completedLessons: 1, totalLessons: 1 },
      { chapterId: chapter2.id, completedLessons: 0, totalLessons: 1 },
    ]);
  });

  it("excludes started-but-not-completed lessons from lesson completion", async () => {
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

    // Started but not completed
    await lessonProgressFixture({
      completedAt: null,
      durationSeconds: 30,
      lessonId: lesson.id,
      userId: user.id,
    });

    const input = await loadChapterProgressInput({ courseId: course.id, userId: user.id });
    const result = getChapterProgress(input);
    expect(result).toStrictEqual([{ chapterId: chapter.id, completedLessons: 0, totalLessons: 1 }]);
  });

  it("only counts published lessons", async () => {
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

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: publishedLesson.id,
      userId: user.id,
    });

    const input = await loadChapterProgressInput({ courseId: course.id, userId: user.id });
    const result = getChapterProgress(input);
    expect(result).toStrictEqual([{ chapterId: chapter.id, completedLessons: 1, totalLessons: 1 }]);
  });

  it("excludes hidden lesson kinds from chapter totals", async () => {
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

    const input = await loadChapterProgressInput({
      courseId: course.id,
      excludedLessonKinds: ["quiz"],
      userId: user.id,
    });

    const result = getChapterProgress(input);

    expect(result).toStrictEqual([{ chapterId: chapter.id, completedLessons: 1, totalLessons: 1 }]);
  });

  it("chapters with 0 published lessons return totalLessons 0", async () => {
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

    const input = await loadChapterProgressInput({ courseId: course.id, userId: user.id });
    const result = getChapterProgress(input);
    expect(result).toStrictEqual([{ chapterId: chapter.id, completedLessons: 0, totalLessons: 0 }]);
  });

  it("incomplete lessons still count toward the chapter total", async () => {
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

    await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const input = await loadChapterProgressInput({ courseId: course.id, userId: user.id });
    const result = getChapterProgress(input);
    expect(result).toStrictEqual([{ chapterId: chapter.id, completedLessons: 0, totalLessons: 1 }]);
  });

  it("a chapter stays in progress while another published lesson is incomplete", async () => {
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

    const [completedLesson] = await Promise.all([
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

    const input = await loadChapterProgressInput({ courseId: course.id, userId: user.id });
    const result = getChapterProgress(input);

    expect(result).toStrictEqual([{ chapterId: chapter.id, completedLessons: 1, totalLessons: 2 }]);
  });

  it("keeps a durably completed chapter completed when a new lesson is added later", async () => {
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

    await Promise.all([
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

    await prisma.chapterCompletion.create({ data: { chapterId: chapter.id, userId: user.id } });

    const input = await loadChapterProgressInput({ courseId: course.id, userId: user.id });
    const result = getChapterProgress(input);

    expect(result).toStrictEqual([{ chapterId: chapter.id, completedLessons: 2, totalLessons: 2 }]);
  });
});
