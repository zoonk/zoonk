import { type LessonKind, prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, it } from "vitest";
import { type LessonScope } from "../lessons/lesson-scope";
import {
  type ContinueTarget,
  getContinueLessonTarget,
  toActiveCatalogTarget,
} from "./get-continue-lesson-target";
import { getLastCompletedLessonAnchor, getNextLessonState } from "./get-next-lesson-state";
import {
  hasDurableCourseCompletion,
  listDurableChapterCompletionIds,
  listPublishedCourseChapters,
  listPublishedLessonProgressRows,
} from "./progress-queries";

type CourseTree = {
  chapter: Awaited<ReturnType<typeof chapterFixture>>;
  course: Awaited<ReturnType<typeof courseFixture>>;
  lessons: Awaited<ReturnType<typeof lessonFixture>>[];
};

type TwoChapterCourseTree = {
  course: Awaited<ReturnType<typeof courseFixture>>;
  firstChapter: Awaited<ReturnType<typeof chapterFixture>>;
  firstLesson: Awaited<ReturnType<typeof lessonFixture>>;
  reviewLesson: Awaited<ReturnType<typeof lessonFixture>>;
  secondChapter: Awaited<ReturnType<typeof chapterFixture>>;
  secondLesson: Awaited<ReturnType<typeof lessonFixture>>;
};

/**
 * Runs the explicit read-leaf and pure-selector pipeline used by app adapters.
 * Keeping it in one helper makes each behavior case focus on the curriculum
 * state it creates while still exercising the new public contract.
 */
async function resolveContinueTarget({
  excludedLessonKinds,
  scope,
  userId,
}: {
  excludedLessonKinds?: LessonKind[];
  scope: LessonScope;
  userId: string | null;
}): Promise<ContinueTarget | null> {
  const courseId = "courseId" in scope ? scope.courseId : null;

  const [chapters, courseCompleted, durableChapterCompletionIds, rows] = await Promise.all([
    courseId ? listPublishedCourseChapters({ courseId }) : Promise.resolve([]),
    courseId ? hasDurableCourseCompletion({ courseId, userId }) : Promise.resolve(false),
    listDurableChapterCompletionIds({ excludedLessonKinds, scope, userId }),
    listPublishedLessonProgressRows({ excludedLessonKinds, scope, userId }),
  ]);

  const after = getLastCompletedLessonAnchor({ rows });

  const state = getNextLessonState({
    after,
    courseCompleted,
    durableChapterCompletionIds,
    rows,
    scope,
  });

  return getContinueLessonTarget({ chapters, scope, state });
}

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

  /**
   * Completed-course review needs a final chapter with a real review lesson.
   * Keeping that shape in one helper makes the tests assert product behavior
   * instead of the mechanics of creating multi-chapter fixture data.
   */
  async function createTwoChapterCourseTree(): Promise<TwoChapterCourseTree> {
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const [firstChapter, secondChapter] = await Promise.all([
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

    const [firstLesson, secondLesson, reviewLesson] = await Promise.all([
      lessonFixture({
        chapterId: firstChapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: secondChapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: secondChapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "review",
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    return { course, firstChapter, firstLesson, reviewLesson, secondChapter, secondLesson };
  }

  it("returns first lesson when unauthenticated", async () => {
    const { chapter, course, lessons } = await createCourseTree();

    const scope = { courseId: course.id } as const;
    const result = await resolveContinueTarget({ scope, userId: null });

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

    const scope = { courseId: course.id } as const;
    const result = await resolveContinueTarget({ scope, userId: null });

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

  it("returns next lesson after the furthest completed lesson", async () => {
    const [user, tree] = await Promise.all([userFixture(), createCourseTree()]);
    const [completedLesson, nextLesson] = tree.lessons;

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: completedLesson?.id ?? "",
      userId: user.id,
    });

    const scope = { courseId: tree.course.id } as const;
    const result = await resolveContinueTarget({ scope, userId: user.id });

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

  it("ignores an opened lesson in a later chapter when completed progress has an earlier target", async () => {
    const [user, tree] = await Promise.all([userFixture(), createTwoChapterCourseTree()]);

    const nextFirstChapterLesson = await lessonFixture({
      chapterId: tree.firstChapter.id,
      generationStatus: "completed",
      isPublished: true,
      organizationId: organization.id,
      position: 1,
    });

    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date("2024-01-01T10:00:00Z"),
        durationSeconds: 60,
        lessonId: tree.firstLesson.id,
        userId: user.id,
      }),
      lessonProgressFixture({
        completedAt: null,
        durationSeconds: null,
        lessonId: tree.secondLesson.id,
        startedAt: new Date("2024-01-02T10:00:00Z"),
        userId: user.id,
      }),
    ]);

    const scope = { courseId: tree.course.id } as const;
    const result = await resolveContinueTarget({ scope, userId: user.id });

    expect(result).toStrictEqual({
      brandSlug: organization.slug,
      canPrefetch: true,
      chapterSlug: tree.firstChapter.slug,
      completed: false,
      courseSlug: tree.course.slug,
      hasStarted: true,
      lessonPosition: 1,
      lessonSlug: nextFirstChapterLesson.slug,
    });

    expect(toActiveCatalogTarget(result)).toStrictEqual({
      chapterSlug: tree.firstChapter.slug,
      lessonSlug: nextFirstChapterLesson.slug,
    });
  });

  it("does not show an active target for opened-only progress", async () => {
    const [user, tree] = await Promise.all([userFixture(), createCourseTree()]);
    const [firstLesson, openedLesson] = tree.lessons;

    await lessonProgressFixture({
      completedAt: null,
      durationSeconds: null,
      lessonId: openedLesson?.id ?? "",
      startedAt: new Date("2024-01-02T10:00:00Z"),
      userId: user.id,
    });

    const scope = { chapterId: tree.chapter.id } as const;
    const result = await resolveContinueTarget({ scope, userId: user.id });

    expect(result).toStrictEqual({
      brandSlug: organization.slug,
      canPrefetch: true,
      chapterSlug: tree.chapter.slug,
      completed: false,
      courseSlug: tree.course.slug,
      hasStarted: false,
      lessonPosition: 0,
      lessonSlug: firstLesson?.slug,
    });

    expect(toActiveCatalogTarget(result)).toBeNull();
  });

  it("continues from the furthest visible completion when a newer hidden lesson is completed", async () => {
    const [user, tree] = await Promise.all([
      userFixture(),
      createCourseTree({
        lessonKinds: ["explanation", "explanation", "quiz"],
        lessonStatuses: ["completed", "completed", "completed"],
      }),
    ]);

    const [completedLesson, nextVisibleLesson, hiddenCompletedLesson] = tree.lessons;

    await Promise.all([
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

    const excludedLessonKinds: LessonKind[] = ["quiz"];
    const scope = { courseId: tree.course.id } as const;
    const result = await resolveContinueTarget({ excludedLessonKinds, scope, userId: user.id });

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

    await lessonProgressFixture({
      completedAt: new Date("2024-01-01"),
      durationSeconds: 60,
      lessonId: completedLesson?.id ?? "",
      userId: user.id,
    });

    const excludedLessonKinds: LessonKind[] = ["quiz"];
    const scope = { courseId: tree.course.id } as const;
    const result = await resolveContinueTarget({ excludedLessonKinds, scope, userId: user.id });

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

  it("returns the furthest completed lesson as review state when the course is complete", async () => {
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

    const scope = { courseId: tree.course.id } as const;
    const result = await resolveContinueTarget({ scope, userId: user.id });

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

  it("returns the last chapter review lesson when a durable course is complete", async () => {
    const [user, tree] = await Promise.all([userFixture(), createTwoChapterCourseTree()]);

    await prisma.courseCompletion.create({ data: { courseId: tree.course.id, userId: user.id } });

    const scope = { courseId: tree.course.id } as const;
    const result = await resolveContinueTarget({ scope, userId: user.id });

    expect(result).toStrictEqual({
      brandSlug: organization.slug,
      canPrefetch: true,
      chapterSlug: tree.secondChapter.slug,
      completed: true,
      courseSlug: tree.course.slug,
      hasStarted: true,
      lessonPosition: 1,
      lessonSlug: tree.reviewLesson.slug,
    });
  });

  it("returns an earlier incomplete course lesson before reviewing the final completion", async () => {
    const [user, tree] = await Promise.all([
      userFixture(),
      createCourseTree({ lessonStatuses: ["completed", "completed", "completed"] }),
    ]);

    const [completedLesson, incompleteLesson, finalLesson] = tree.lessons;

    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date("2024-01-01"),
        durationSeconds: 60,
        lessonId: completedLesson?.id ?? "",
        userId: user.id,
      }),
      lessonProgressFixture({
        completedAt: new Date("2024-01-02"),
        durationSeconds: 60,
        lessonId: finalLesson?.id ?? "",
        userId: user.id,
      }),
    ]);

    const scope = { courseId: tree.course.id } as const;
    const result = await resolveContinueTarget({ scope, userId: user.id });

    expect(result).toStrictEqual({
      brandSlug: organization.slug,
      canPrefetch: true,
      chapterSlug: tree.chapter.slug,
      completed: false,
      courseSlug: tree.course.slug,
      hasStarted: true,
      lessonPosition: 1,
      lessonSlug: incompleteLesson?.slug,
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

    const scope = { courseId: course.id } as const;
    const result = await resolveContinueTarget({ scope, userId: user.id });

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

    const scope = { chapterId: tree.chapter.id } as const;
    const result = await resolveContinueTarget({ scope, userId: user.id });

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

  it("returns an earlier incomplete chapter lesson before reviewing the final completion", async () => {
    const [user, tree] = await Promise.all([
      userFixture(),
      createCourseTree({ lessonStatuses: ["completed", "completed", "completed"] }),
    ]);

    const [completedLesson, incompleteLesson, finalLesson] = tree.lessons;

    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date("2024-01-01"),
        durationSeconds: 60,
        lessonId: completedLesson?.id ?? "",
        userId: user.id,
      }),
      lessonProgressFixture({
        completedAt: new Date("2024-01-02"),
        durationSeconds: 60,
        lessonId: finalLesson?.id ?? "",
        userId: user.id,
      }),
    ]);

    const scope = { chapterId: tree.chapter.id } as const;
    const result = await resolveContinueTarget({ scope, userId: user.id });

    expect(result).toStrictEqual({
      brandSlug: organization.slug,
      canPrefetch: true,
      chapterSlug: tree.chapter.slug,
      completed: false,
      courseSlug: tree.course.slug,
      hasStarted: true,
      lessonPosition: 1,
      lessonSlug: incompleteLesson?.slug,
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

    const scope = { lessonId: lesson?.id ?? "" } as const;
    const result = await resolveContinueTarget({ scope, userId: user.id });

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
