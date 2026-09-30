import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import {
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { catalogCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getCatalogChapterNextLesson, getCatalogCourseNextLesson } from "./next-lesson";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

function finishLessons({ lessonIds, userId }: { lessonIds: string[]; userId: string }) {
  return Promise.all(
    lessonIds.map((lessonId) => learningEventFixture({ contentIds: { lessonId }, userId })),
  );
}

describe(getCatalogCourseNextLesson, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("starts visitors at the first lesson", async () => {
    const { chapters, course, lessons, organization } = await catalogCourseFixture({
      lessonCounts: [2, 1],
    });

    await expect(getCatalogCourseNextLesson({ courseId: course.id })).resolves.toStrictEqual({
      status: "ready",
      target: {
        brandSlug: organization.slug,
        canPrefetch: true,
        chapterId: chapters[0]!.id,
        chapterSlug: chapters[0]!.slug,
        completed: false,
        courseId: course.id,
        courseSlug: course.slug,
        hasStarted: false,
        lessonId: lessons[0]![0]!.id,
        lessonPosition: 0,
        lessonSlug: lessons[0]![0]!.slug,
        type: "lesson",
      },
    });
  });

  it("continues at the first unfinished lesson in reading order", async () => {
    const [learner, { course, lessons }] = await Promise.all([
      userFixture(),
      catalogCourseFixture({ lessonCounts: [2, 2] }),
    ]);

    await finishLessons({
      lessonIds: [lessons[0]![0]!.id, lessons[0]![1]!.id, lessons[1]![1]!.id],
      userId: learner.id,
    });

    await prisma.lesson.update({
      data: { contentStatus: "pending" },
      where: { id: lessons[1]![0]!.id },
    });

    mockSession(learner.id);

    await expect(getCatalogCourseNextLesson({ courseId: course.id })).resolves.toMatchObject({
      status: "ready",
      target: {
        canPrefetch: false,
        completed: false,
        hasStarted: true,
        lessonId: lessons[1]![0]!.id,
        lessonPosition: 0,
        type: "lesson",
      },
    });
  });

  it("goes to the next chapter when its lessons aren't written yet", async () => {
    const [learner, { course, lessons }] = await Promise.all([
      userFixture(),
      catalogCourseFixture({ lessonCounts: [1] }),
    ]);

    const pending = await libraryChapterFixture({ homeCourseId: course.id });

    await Promise.all([
      courseChapterFixture({ chapterId: pending.id, courseId: course.id, position: 1 }),
      finishLessons({ lessonIds: [lessons[0]![0]!.id], userId: learner.id }),
    ]);

    mockSession(learner.id);

    await expect(getCatalogCourseNextLesson({ courseId: course.id })).resolves.toStrictEqual({
      status: "ready",
      target: expect.objectContaining({
        canPrefetch: false,
        chapterId: pending.id,
        completed: false,
        hasStarted: true,
        type: "chapter",
      }),
    });
  });

  it("reviews the first lesson once every lesson is finished", async () => {
    const [learner, { course, lessons }] = await Promise.all([
      userFixture(),
      catalogCourseFixture({ lessonCounts: [1, 1] }),
    ]);

    await finishLessons({
      lessonIds: lessons.flat().map((lesson) => lesson.id),
      userId: learner.id,
    });

    mockSession(learner.id);

    await expect(getCatalogCourseNextLesson({ courseId: course.id })).resolves.toMatchObject({
      target: { completed: true, hasStarted: true, lessonId: lessons[0]![0]!.id, type: "lesson" },
    });
  });

  it("has no target for a course without chapters and isn't found outside the catalog", async () => {
    const { course } = await catalogCourseFixture({ lessonCounts: [] });

    const results = await Promise.all([
      getCatalogCourseNextLesson({ courseId: course.id }),
      getCatalogCourseNextLesson({ courseId: randomUUID() }),
    ]);

    expect(results).toStrictEqual([{ status: "ready", target: null }, { status: "notFound" }]);
  });
});

describe(getCatalogChapterNextLesson, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("continues inside the chapter, in the course it's read in", async () => {
    const [learner, home, other] = await Promise.all([
      userFixture(),
      catalogCourseFixture({ lessonCounts: [3] }),
      catalogCourseFixture({ lessonCounts: [] }),
    ]);

    const chapter = home.chapters[0]!;

    await Promise.all([
      courseChapterFixture({ chapterId: chapter.id, courseId: other.course.id }),
      finishLessons({ lessonIds: [home.lessons[0]![0]!.id], userId: learner.id }),
    ]);

    mockSession(learner.id);

    const [inHome, inOther] = await Promise.all([
      getCatalogChapterNextLesson({ chapterId: chapter.id }),
      getCatalogChapterNextLesson({ chapterId: chapter.id, courseId: other.course.id }),
    ]);

    expect(inHome).toMatchObject({
      target: {
        courseId: home.course.id,
        hasStarted: true,
        lessonId: home.lessons[0]![1]!.id,
        lessonPosition: 1,
      },
    });

    expect(inOther).toMatchObject({
      target: {
        brandSlug: other.organization.slug,
        courseId: other.course.id,
        courseSlug: other.course.slug,
        lessonId: home.lessons[0]![1]!.id,
      },
    });
  });

  it("has no target while the chapter's lessons aren't written", async () => {
    const { course } = await catalogCourseFixture({ lessonCounts: [] });
    const chapter = await libraryChapterFixture({ homeCourseId: course.id });

    await courseChapterFixture({ chapterId: chapter.id, courseId: course.id });

    await expect(getCatalogChapterNextLesson({ chapterId: chapter.id })).resolves.toStrictEqual({
      status: "ready",
      target: null,
    });
  });

  it("isn't found in a course that doesn't place the chapter", async () => {
    const [home, other] = await Promise.all([
      catalogCourseFixture({ lessonCounts: [1] }),
      catalogCourseFixture({ lessonCounts: [1] }),
    ]);

    await expect(
      getCatalogChapterNextLesson({ chapterId: home.chapters[0]!.id, courseId: other.course.id }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});
