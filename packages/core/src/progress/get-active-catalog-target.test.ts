import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, it } from "vitest";
import { getActiveCatalogTarget } from "./get-active-catalog-target";

type CourseTree = {
  chapter: Awaited<ReturnType<typeof chapterFixture>>;
  course: Awaited<ReturnType<typeof courseFixture>>;
  lessons: Awaited<ReturnType<typeof lessonFixture>>[];
};

type TwoChapterCourseTree = {
  course: Awaited<ReturnType<typeof courseFixture>>;
  firstChapter: Awaited<ReturnType<typeof chapterFixture>>;
  firstChapterLessons: Awaited<ReturnType<typeof lessonFixture>>[];
  secondChapter: Awaited<ReturnType<typeof chapterFixture>>;
  secondChapterLessons: Awaited<ReturnType<typeof lessonFixture>>[];
};

describe(getActiveCatalogTarget, () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;

  beforeAll(async () => {
    organization = await organizationFixture({ kind: "brand" });
  });

  /**
   * Active-target tests need a tiny published chapter with stable lesson order
   * so each case can focus on the progress timestamp that defines "current".
   */
  async function createCourseTree(): Promise<CourseTree> {
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const lessons = await Promise.all(
      [0, 1, 2].map((position) =>
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "completed",
          isPublished: true,
          organizationId: organization.id,
          position,
        }),
      ),
    );

    return { chapter, course, lessons };
  }

  /**
   * Course-level targets must ignore lessons the learner opened but did not
   * complete, even when that opened lesson sits in a later chapter.
   */
  async function createTwoChapterCourseTree(): Promise<TwoChapterCourseTree> {
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const [firstChapter, secondChapter] = await Promise.all(
      [0, 1].map((position) =>
        chapterFixture({
          courseId: course.id,
          isPublished: true,
          organizationId: organization.id,
          position,
        }),
      ),
    );

    if (!firstChapter || !secondChapter) {
      throw new Error("Active catalog target fixture did not create both chapters.");
    }

    const firstChapterLessons = await Promise.all(
      [0, 1].map((position) =>
        lessonFixture({
          chapterId: firstChapter.id,
          generationStatus: "completed",
          isPublished: true,
          organizationId: organization.id,
          position,
        }),
      ),
    );

    const secondChapterLessons = await Promise.all(
      [0].map((position) =>
        lessonFixture({
          chapterId: secondChapter.id,
          generationStatus: "completed",
          isPublished: true,
          organizationId: organization.id,
          position,
        }),
      ),
    );

    return { course, firstChapter, firstChapterLessons, secondChapter, secondChapterLessons };
  }

  it("uses the next lesson after completion for course-level chapter targets", async () => {
    const [user, tree] = await Promise.all([userFixture(), createTwoChapterCourseTree()]);
    const [completedLesson, expectedLesson] = tree.firstChapterLessons;
    const [startedLesson] = tree.secondChapterLessons;

    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date("2024-01-01T10:00:00Z"),
        durationSeconds: 60,
        lessonId: completedLesson?.id ?? "",
        userId: user.id,
      }),
      lessonProgressFixture({
        completedAt: null,
        durationSeconds: null,
        lessonId: startedLesson?.id ?? "",
        startedAt: new Date("2024-01-02T10:00:00Z"),
        userId: user.id,
      }),
    ]);

    const headers = await signInAs(user.email, user.password);

    const result = await getActiveCatalogTarget({ headers, scope: { courseId: tree.course.id } });

    expect(result).toStrictEqual({
      chapterSlug: tree.firstChapter.slug,
      lessonSlug: expectedLesson?.slug,
    });
  });

  it("ignores started lessons when lesson targets require completed progress", async () => {
    const [user, tree] = await Promise.all([userFixture(), createCourseTree()]);
    const startedLesson = tree.lessons[2];

    await lessonProgressFixture({
      completedAt: null,
      durationSeconds: null,
      lessonId: startedLesson?.id ?? "",
      startedAt: new Date("2024-01-02T10:00:00Z"),
      userId: user.id,
    });

    const headers = await signInAs(user.email, user.password);

    const result = await getActiveCatalogTarget({ headers, scope: { chapterId: tree.chapter.id } });

    expect(result).toBeNull();
  });

  it("uses the next lesson after the latest completed lesson", async () => {
    const [user, tree] = await Promise.all([userFixture(), createCourseTree()]);
    const [completedLesson, nextLesson, startedLesson] = tree.lessons;

    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date("2024-01-01T10:00:00Z"),
        durationSeconds: 60,
        lessonId: completedLesson?.id ?? "",
        userId: user.id,
      }),
      lessonProgressFixture({
        completedAt: null,
        durationSeconds: null,
        lessonId: startedLesson?.id ?? "",
        startedAt: new Date("2024-01-02T10:00:00Z"),
        userId: user.id,
      }),
    ]);

    const headers = await signInAs(user.email, user.password);

    const result = await getActiveCatalogTarget({ headers, scope: { chapterId: tree.chapter.id } });

    expect(result).toStrictEqual({ chapterSlug: tree.chapter.slug, lessonSlug: nextLesson?.slug });
  });
});
