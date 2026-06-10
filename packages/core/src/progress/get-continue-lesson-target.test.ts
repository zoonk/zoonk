import { type LessonKind } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, it } from "vitest";
import { getContinueLessonTarget } from "./get-continue-lesson-target";

type CourseTree = {
  chapter: Awaited<ReturnType<typeof chapterFixture>>;
  course: Awaited<ReturnType<typeof courseFixture>>;
  lessons: Awaited<ReturnType<typeof lessonFixture>>[];
};

describe(getContinueLessonTarget, () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;

  beforeAll(async () => {
    organization = await organizationFixture({ kind: "brand" });
  });

  /**
   * Continue-target tests need small published course trees with predictable
   * lesson order. This helper keeps each case focused on the progress state
   * being tested instead of repeating catalog setup.
   */
  async function createCourseTree({
    lessonKinds = [],
    lessonStatuses = ["completed", "completed"],
  }: {
    lessonKinds?: LessonKind[];
    lessonStatuses?: ("completed" | "failed" | "pending" | "running")[];
  } = {}): Promise<CourseTree> {
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const lessons = await Promise.all(
      lessonStatuses.map((generationStatus, position) =>
        lessonFixture({
          chapterId: chapter.id,
          generationStatus,
          isPublished: true,
          kind: lessonKinds[position] ?? "explanation",
          organizationId: organization.id,
          position,
        }),
      ),
    );

    return { chapter, course, lessons };
  }

  it("returns first lesson when unauthenticated", async () => {
    const { chapter, course, lessons } = await createCourseTree();

    const result = await getContinueLessonTarget({
      headers: new Headers(),
      scope: { courseId: course.id },
    });

    expect(result).toStrictEqual({
      brandSlug: organization.slug,
      canPrefetch: true,
      chapterSlug: chapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: false,
      lessonPosition: 0,
      lessonSlug: lessons[0]?.slug,
    });
  });

  it("returns a shell link when the first lesson still needs generation", async () => {
    const { chapter, course, lessons } = await createCourseTree({
      lessonStatuses: ["pending", "completed"],
    });

    const result = await getContinueLessonTarget({
      headers: new Headers(),
      scope: { courseId: course.id },
    });

    expect(result).toStrictEqual({
      brandSlug: organization.slug,
      canPrefetch: false,
      chapterSlug: chapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: false,
      lessonPosition: 0,
      lessonSlug: lessons[0]?.slug,
    });
  });

  it("returns next lesson after the latest completed lesson", async () => {
    const [user, tree] = await Promise.all([userFixture(), createCourseTree()]);
    const [completedLesson, nextLesson] = tree.lessons;

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: completedLesson?.id ?? "",
      userId: user.id,
    });

    const headers = await signInAs(user.email, user.password);

    const result = await getContinueLessonTarget({ headers, scope: { courseId: tree.course.id } });

    expect(result).toStrictEqual({
      brandSlug: organization.slug,
      canPrefetch: true,
      chapterSlug: tree.chapter.slug,
      completed: false,
      courseSlug: tree.course.slug,
      hasStarted: true,
      lessonPosition: 1,
      lessonSlug: nextLesson?.slug,
    });
  });

  it("continues from the latest visible completion when a newer hidden lesson is completed", async () => {
    const [user, tree] = await Promise.all([
      userFixture(),
      createCourseTree({
        lessonKinds: ["explanation", "explanation", "quiz"],
        lessonStatuses: ["completed", "completed", "completed"],
      }),
    ]);

    const [completedLesson, nextVisibleLesson, hiddenCompletedLesson] = tree.lessons;

    const [headers] = await Promise.all([
      signInAs(user.email, user.password),
      lessonProgressFixture({
        completedAt: new Date("2024-01-01"),
        durationSeconds: 60,
        lessonId: completedLesson?.id ?? "",
        userId: user.id,
      }),
      lessonProgressFixture({
        completedAt: new Date("2024-01-02"),
        durationSeconds: 60,
        lessonId: hiddenCompletedLesson?.id ?? "",
        userId: user.id,
      }),
    ]);

    const result = await getContinueLessonTarget({
      excludedLessonKinds: ["quiz"],
      headers,
      scope: { courseId: tree.course.id },
    });

    expect(result).toStrictEqual({
      brandSlug: organization.slug,
      canPrefetch: true,
      chapterSlug: tree.chapter.slug,
      completed: false,
      courseSlug: tree.course.slug,
      hasStarted: true,
      lessonPosition: 1,
      lessonSlug: nextVisibleLesson?.slug,
    });
  });

  it("skips hidden incomplete lessons when choosing the next lesson", async () => {
    const [user, tree] = await Promise.all([
      userFixture(),
      createCourseTree({
        lessonKinds: ["explanation", "quiz", "explanation"],
        lessonStatuses: ["completed", "completed", "completed"],
      }),
    ]);

    const [completedLesson, hiddenLesson, nextVisibleLesson] = tree.lessons;

    const [headers] = await Promise.all([
      signInAs(user.email, user.password),
      lessonProgressFixture({
        completedAt: new Date("2024-01-01"),
        durationSeconds: 60,
        lessonId: completedLesson?.id ?? "",
        userId: user.id,
      }),
    ]);

    const result = await getContinueLessonTarget({
      excludedLessonKinds: ["quiz"],
      headers,
      scope: { courseId: tree.course.id },
    });

    expect(result).toStrictEqual({
      brandSlug: organization.slug,
      canPrefetch: true,
      chapterSlug: tree.chapter.slug,
      completed: false,
      courseSlug: tree.course.slug,
      hasStarted: true,
      lessonPosition: 2,
      lessonSlug: nextVisibleLesson?.slug,
    });

    expect(result).not.toMatchObject({ lessonSlug: hiddenLesson?.slug });
  });

  it("returns the latest completed lesson as review state when the course is complete", async () => {
    const [user, tree] = await Promise.all([userFixture(), createCourseTree()]);
    const [lesson1, lesson2] = tree.lessons;

    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date("2024-01-01"),
        durationSeconds: 60,
        lessonId: lesson1?.id ?? "",
        userId: user.id,
      }),
      lessonProgressFixture({
        completedAt: new Date("2024-01-02"),
        durationSeconds: 60,
        lessonId: lesson2?.id ?? "",
        userId: user.id,
      }),
    ]);

    const headers = await signInAs(user.email, user.password);

    const result = await getContinueLessonTarget({ headers, scope: { courseId: tree.course.id } });

    expect(result).toStrictEqual({
      brandSlug: organization.slug,
      canPrefetch: true,
      chapterSlug: tree.chapter.slug,
      completed: true,
      courseSlug: tree.course.slug,
      hasStarted: true,
      lessonPosition: 1,
      lessonSlug: lesson2?.slug,
    });
  });

  it("returns a chapter target when the next chapter has no lesson shell yet", async () => {
    const [user, course] = await Promise.all([
      userFixture(),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    const [completedChapter, nextChapter] = await Promise.all([
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

    const lesson = await lessonFixture({
      chapterId: completedChapter.id,
      generationStatus: "completed",
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: lesson.id,
      userId: user.id,
    });

    const headers = await signInAs(user.email, user.password);

    const result = await getContinueLessonTarget({ headers, scope: { courseId: course.id } });

    expect(result).toStrictEqual({
      brandSlug: organization.slug,
      canPrefetch: false,
      chapterSlug: nextChapter.slug,
      completed: false,
      courseSlug: course.slug,
      hasStarted: true,
    });
  });

  it("chapter scope stays inside the requested chapter", async () => {
    const [user, tree] = await Promise.all([userFixture(), createCourseTree()]);
    const [completedLesson, nextLesson] = tree.lessons;

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: completedLesson?.id ?? "",
      userId: user.id,
    });

    const headers = await signInAs(user.email, user.password);

    const result = await getContinueLessonTarget({
      headers,
      scope: { chapterId: tree.chapter.id },
    });

    expect(result).toStrictEqual({
      brandSlug: organization.slug,
      canPrefetch: true,
      chapterSlug: tree.chapter.slug,
      completed: false,
      courseSlug: tree.course.slug,
      hasStarted: true,
      lessonPosition: 1,
      lessonSlug: nextLesson?.slug,
    });
  });

  it("lesson scope returns that lesson completion state", async () => {
    const [user, tree] = await Promise.all([userFixture(), createCourseTree()]);
    const [lesson] = tree.lessons;

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: lesson?.id ?? "",
      userId: user.id,
    });

    const headers = await signInAs(user.email, user.password);

    const result = await getContinueLessonTarget({
      headers,
      scope: { lessonId: lesson?.id ?? "" },
    });

    expect(result).toStrictEqual({
      brandSlug: organization.slug,
      canPrefetch: true,
      chapterSlug: tree.chapter.slug,
      completed: true,
      courseSlug: tree.course.slug,
      hasStarted: true,
      lessonPosition: 0,
      lessonSlug: lesson?.slug,
    });
  });
});
