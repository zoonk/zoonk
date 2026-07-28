import { randomUUID } from "node:crypto";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getChapterProgressResource } from "./get-chapter-progress-for-current-user";
import { getCourseProgressResource } from "./get-course-progress";
import { getNextLessonResource } from "./get-next-lesson";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

const context = await createProgressResourceContext();

/**
 * Creates the reusable caller and organization types needed to prove that
 * public progress resources enforce the same published-brand boundary as the
 * catalog resources they describe.
 */
async function createProgressResourceContext() {
  const [brandOrganization, schoolOrganization, user] = await Promise.all([
    organizationFixture({ kind: "brand" }),
    organizationFixture({ kind: "school" }),
    userFixture(),
  ]);

  return { brandOrganization, schoolOrganization, user };
}

/**
 * Creates one published brand curriculum with no completion rows so successful
 * resource tests prove that "no learner progress" is different from "resource
 * not found."
 */
async function createEmptyProgressCurriculum() {
  const course = await courseFixture({
    isPublished: true,
    organizationId: context.brandOrganization.id,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: context.brandOrganization.id,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    isPublished: true,
    organizationId: context.brandOrganization.id,
  });

  return { chapter, course, lesson };
}

describe("progress resource access", () => {
  beforeAll(() => {
    mockSession(context.user.id);
  });

  it("returns course and chapter resources when a learner has no progress", async () => {
    const { chapter, course, lesson } = await createEmptyProgressCurriculum();

    const [courseProgress, chapterProgress] = await Promise.all([
      getCourseProgressResource({ courseId: course.id }),
      getChapterProgressResource({ chapterId: chapter.id }),
    ]);

    expect(courseProgress).toStrictEqual({
      chapters: [{ chapterId: chapter.id, completedLessons: 0, totalLessons: 1 }],
      percentComplete: 0,
    });

    expect(chapterProgress).toStrictEqual({
      lessons: [{ isCompleted: false, lessonId: lesson.id }],
      percentComplete: 0,
    });
  });

  it("returns not found for unknown, unpublished, and non-brand progress resources", async () => {
    const [unpublishedCourse, schoolCourse] = await Promise.all([
      courseFixture({ isPublished: false, organizationId: context.brandOrganization.id }),
      courseFixture({ isPublished: true, organizationId: context.schoolOrganization.id }),
    ]);

    const [unpublishedChapter, schoolChapter] = await Promise.all([
      chapterFixture({
        courseId: unpublishedCourse.id,
        isPublished: true,
        organizationId: context.brandOrganization.id,
      }),
      chapterFixture({
        courseId: schoolCourse.id,
        isPublished: true,
        organizationId: context.schoolOrganization.id,
      }),
    ]);

    const [
      unknownCourse,
      hiddenCourse,
      nonBrandCourse,
      unknownChapter,
      hiddenChapter,
      nonBrandChapter,
    ] = await Promise.all([
      getCourseProgressResource({ courseId: randomUUID() }),
      getCourseProgressResource({ courseId: unpublishedCourse.id }),
      getCourseProgressResource({ courseId: schoolCourse.id }),
      getChapterProgressResource({ chapterId: randomUUID() }),
      getChapterProgressResource({ chapterId: unpublishedChapter.id }),
      getChapterProgressResource({ chapterId: schoolChapter.id }),
    ]);

    expect([
      unknownCourse,
      hiddenCourse,
      nonBrandCourse,
      unknownChapter,
      hiddenChapter,
      nonBrandChapter,
    ]).toStrictEqual([null, null, null, null, null, null]);
  });

  it("distinguishes an empty next-learning target from an unavailable resource", async () => {
    const emptyCourse = await courseFixture({
      isPublished: true,
      organizationId: context.brandOrganization.id,
    });

    const [empty, unknown] = await Promise.all([
      getNextLessonResource({ scope: { courseId: emptyCourse.id } }),
      getNextLessonResource({ scope: { courseId: randomUUID() } }),
    ]);

    expect(empty).toStrictEqual({ status: "ready", target: null });
    expect(unknown).toStrictEqual({ status: "notFound" });
  });
});
