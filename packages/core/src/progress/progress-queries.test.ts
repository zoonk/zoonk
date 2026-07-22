import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import {
  hasDurableCourseCompletion,
  listDurableChapterCompletionIds,
  listPublishedCourseChapters,
  listPublishedLessonProgressRows,
} from "./progress-queries";

/**
 * Creates a small published course with two ordered chapters and lessons so
 * query tests can focus on scope and ownership without sharing fixture data.
 */
async function createPublishedCourseTree() {
  const organization = await organizationFixture({ kind: "brand" });
  const course = await courseFixture({ isPublished: true, organizationId: organization.id });

  const [firstChapter, secondChapter] = await Promise.all([
    chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
      title: "First chapter",
    }),
    chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 1,
      title: "Second chapter",
    }),
  ]);

  const [firstLesson, secondLesson] = await Promise.all([
    lessonFixture({
      chapterId: firstChapter.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
      title: "First lesson",
    }),
    lessonFixture({
      chapterId: secondChapter.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
      title: "Second lesson",
    }),
  ]);

  return { course, firstChapter, firstLesson, organization, secondChapter, secondLesson };
}

describe(listPublishedLessonProgressRows, () => {
  it("honors course, chapter, and lesson scopes while preserving curriculum order", async () => {
    const tree = await createPublishedCourseTree();

    const [courseRows, chapterRows, lessonRows] = await Promise.all([
      listPublishedLessonProgressRows({ scope: { courseId: tree.course.id }, userId: null }),
      listPublishedLessonProgressRows({
        scope: { chapterId: tree.secondChapter.id },
        userId: null,
      }),
      listPublishedLessonProgressRows({ scope: { lessonId: tree.firstLesson.id }, userId: null }),
    ]);

    expect(courseRows.map((row) => row.lessonId)).toStrictEqual([
      tree.firstLesson.id,
      tree.secondLesson.id,
    ]);

    expect(chapterRows.map((row) => row.lessonId)).toStrictEqual([tree.secondLesson.id]);

    expect(lessonRows).toStrictEqual([
      expect.objectContaining({
        brandSlug: tree.organization.slug,
        chapterId: tree.firstChapter.id,
        chapterPosition: 0,
        chapterTitle: tree.firstChapter.title,
        completedLessons: 0,
        courseId: tree.course.id,
        courseSlug: tree.course.slug,
        lessonGenerationStatus: "completed",
        lessonId: tree.firstLesson.id,
        lessonKind: "explanation",
        lessonPosition: 0,
        pendingLessons: 0,
        totalLessons: 1,
      }),
    ]);
  });

  it("filters hidden and unpublished curriculum and counts only the requested user's completion", async () => {
    const [tree, user, otherUser] = await Promise.all([
      createPublishedCourseTree(),
      userFixture(),
      userFixture(),
    ]);

    const unpublishedChapter = await chapterFixture({
      courseId: tree.course.id,
      isPublished: false,
      organizationId: tree.organization.id,
      position: 2,
    });

    const [hiddenLesson, unpublishedLesson, unpublishedChapterLesson] = await Promise.all([
      lessonFixture({
        chapterId: tree.firstChapter.id,
        isPublished: true,
        kind: "quiz",
        organizationId: tree.organization.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: tree.firstChapter.id,
        isPublished: false,
        organizationId: tree.organization.id,
        position: 2,
      }),
      lessonFixture({
        chapterId: unpublishedChapter.id,
        isPublished: true,
        organizationId: tree.organization.id,
        position: 0,
      }),
    ]);

    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: tree.firstLesson.id,
        userId: user.id,
      }),
      lessonProgressFixture({
        completedAt: null,
        durationSeconds: 30,
        lessonId: tree.secondLesson.id,
        userId: user.id,
      }),
      lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: tree.secondLesson.id,
        userId: otherUser.id,
      }),
    ]);

    const rows = await listPublishedLessonProgressRows({
      excludedLessonKinds: ["quiz"],
      scope: { courseId: tree.course.id },
      userId: user.id,
    });

    expect(
      rows.map((row) => ({ completedLessons: row.completedLessons, lessonId: row.lessonId })),
    ).toStrictEqual([
      { completedLessons: 1, lessonId: tree.firstLesson.id },
      { completedLessons: 0, lessonId: tree.secondLesson.id },
    ]);

    expect(rows.map((row) => row.lessonId)).not.toContain(hiddenLesson.id);
    expect(rows.map((row) => row.lessonId)).not.toContain(unpublishedLesson.id);
    expect(rows.map((row) => row.lessonId)).not.toContain(unpublishedChapterLesson.id);
  });
});

describe(listPublishedCourseChapters, () => {
  it("returns published chapters in order, including empty chapters", async () => {
    const organization = await organizationFixture({ kind: "brand" });
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const [laterChapter, firstChapter] = await Promise.all([
      chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: organization.id,
        position: 2,
      }),
      chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
      chapterFixture({
        courseId: course.id,
        isPublished: false,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    const chapters = await listPublishedCourseChapters({ courseId: course.id });

    expect(chapters).toStrictEqual([
      {
        brandSlug: organization.slug,
        chapterId: firstChapter.id,
        chapterPosition: 0,
        chapterSlug: firstChapter.slug,
        chapterTitle: firstChapter.title,
        courseSlug: course.slug,
      },
      {
        brandSlug: organization.slug,
        chapterId: laterChapter.id,
        chapterPosition: 2,
        chapterSlug: laterChapter.slug,
        chapterTitle: laterChapter.title,
        courseSlug: course.slug,
      },
    ]);
  });
});

describe(listDurableChapterCompletionIds, () => {
  it("returns completions for the requested user and visible scope only", async () => {
    const [tree, user, otherUser] = await Promise.all([
      createPublishedCourseTree(),
      userFixture(),
      userFixture(),
    ]);

    await Promise.all([
      prisma.chapterCompletion.create({
        data: { chapterId: tree.firstChapter.id, userId: user.id },
      }),
      prisma.chapterCompletion.create({
        data: { chapterId: tree.secondChapter.id, userId: otherUser.id },
      }),
    ]);

    const [courseCompletionIds, lessonCompletionIds, otherUserCompletionIds] = await Promise.all([
      listDurableChapterCompletionIds({ scope: { courseId: tree.course.id }, userId: user.id }),
      listDurableChapterCompletionIds({
        scope: { lessonId: tree.firstLesson.id },
        userId: user.id,
      }),
      listDurableChapterCompletionIds({
        scope: { courseId: tree.course.id },
        userId: otherUser.id,
      }),
    ]);

    expect(courseCompletionIds).toStrictEqual([tree.firstChapter.id]);
    expect(lessonCompletionIds).toStrictEqual([tree.firstChapter.id]);
    expect(otherUserCompletionIds).toStrictEqual([tree.secondChapter.id]);
  });

  it("ignores chapters with no visible lessons and returns no anonymous completions", async () => {
    const [tree, user] = await Promise.all([createPublishedCourseTree(), userFixture()]);

    await prisma.lesson.update({ data: { kind: "quiz" }, where: { id: tree.firstLesson.id } });

    await prisma.chapterCompletion.create({
      data: { chapterId: tree.firstChapter.id, userId: user.id },
    });

    const [hiddenCompletionIds, anonymousCompletionIds] = await Promise.all([
      listDurableChapterCompletionIds({
        excludedLessonKinds: ["quiz"],
        scope: { chapterId: tree.firstChapter.id },
        userId: user.id,
      }),
      listDurableChapterCompletionIds({ scope: { courseId: tree.course.id }, userId: null }),
    ]);

    expect(hiddenCompletionIds).toStrictEqual([]);
    expect(anonymousCompletionIds).toStrictEqual([]);
  });
});

describe(hasDurableCourseCompletion, () => {
  it("matches the exact course and user pair and returns false for anonymous users", async () => {
    const [user, otherUser, firstCourse, secondCourse] = await Promise.all([
      userFixture(),
      userFixture(),
      courseFixture(),
      courseFixture(),
    ]);

    await prisma.courseCompletion.create({ data: { courseId: firstCourse.id, userId: user.id } });

    const [completed, otherUserCompleted, otherCourseCompleted, anonymousCompleted] =
      await Promise.all([
        hasDurableCourseCompletion({ courseId: firstCourse.id, userId: user.id }),
        hasDurableCourseCompletion({ courseId: firstCourse.id, userId: otherUser.id }),
        hasDurableCourseCompletion({ courseId: secondCourse.id, userId: user.id }),
        hasDurableCourseCompletion({ courseId: firstCourse.id, userId: null }),
      ]);

    expect(completed).toBe(true);
    expect(otherUserCompleted).toBe(false);
    expect(otherCourseCompleted).toBe(false);
    expect(anonymousCompleted).toBe(false);
  });
});
