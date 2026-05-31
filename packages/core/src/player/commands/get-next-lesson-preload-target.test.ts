import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { getNextPreloadTargets } from "./get-next-lesson-preload-target";

type PreloadTargetVisibility = {
  chapterIsPublished?: boolean;
  courseIsPublished?: boolean;
  organizationKind?: string;
};

const preloadGenerationStatuses = ["pending", "failed"] as const;
const nonPreloadGenerationStatuses = ["completed", "running"] as const;

const inaccessibleCurrentLessonCases: {
  currentLessonIsPublished?: boolean;
  name: string;
  visibility?: PreloadTargetVisibility;
}[] = [
  { name: "course", visibility: { courseIsPublished: false } },
  { name: "chapter", visibility: { chapterIsPublished: false } },
  { currentLessonIsPublished: false, name: "lesson" },
  { name: "organization", visibility: { organizationKind: "school" } },
];

/**
 * Preload target tests need a normal learner-visible course tree but no player
 * steps, because this command only decides whether the next structural lesson
 * should be generated early.
 */
async function createChapterContext(params: PreloadTargetVisibility = {}) {
  const organization = await organizationFixture({ kind: params.organizationKind ?? "brand" });

  const course = await courseFixture({
    isPublished: params.courseIsPublished ?? true,
    organizationId: organization.id,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: params.chapterIsPublished ?? true,
    organizationId: organization.id,
  });

  return { chapter, organization };
}

/**
 * The command derives the preload target from the current lesson position, so
 * each test creates a two-lesson path with explicit positions and a configurable
 * next lesson generation state.
 */
async function createLessonPair(params: {
  currentLessonIsPublished?: boolean;
  nextLessonGenerationStatus: "completed" | "failed" | "pending" | "running";
  visibility?: PreloadTargetVisibility;
}) {
  const { chapter, organization } = await createChapterContext(params.visibility);

  const [currentLesson, nextLesson] = await Promise.all([
    lessonFixture({
      chapterId: chapter.id,
      isPublished: params.currentLessonIsPublished ?? true,
      organizationId: organization.id,
      position: 0,
    }),
    lessonFixture({
      chapterId: chapter.id,
      generationStatus: params.nextLessonGenerationStatus,
      isPublished: true,
      organizationId: organization.id,
      position: 1,
    }),
  ]);

  return { currentLesson, nextLesson };
}

describe(getNextPreloadTargets, () => {
  it("returns the next lesson target before considering chapter generation", async () => {
    const [user, lessons] = await Promise.all([
      userFixture(),
      createLessonPair({ nextLessonGenerationStatus: "pending" }),
    ]);

    const result = await getNextPreloadTargets({
      lessonId: lessons.currentLesson.id,
      userId: user.id,
    });

    expect(result).toStrictEqual([{ kind: "lesson", lessonId: lessons.nextLesson.id }]);
  });

  it("returns up to three next pending lesson targets in course order", async () => {
    const [user, context] = await Promise.all([userFixture(), createChapterContext()]);

    const lessons = await Promise.all([
      lessonFixture({
        chapterId: context.chapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: context.organization.id,
        position: 0,
      }),
      ...Array.from({ length: 4 }, (_, index) =>
        lessonFixture({
          chapterId: context.chapter.id,
          generationStatus: "pending",
          isPublished: true,
          organizationId: context.organization.id,
          position: index + 1,
        }),
      ),
    ]);

    const [currentLesson, first, second, third] = lessons;

    if (!currentLesson || !first || !second || !third) {
      throw new Error("Expected current lesson plus three preload candidates");
    }

    const result = await getNextPreloadTargets({ lessonId: currentLesson.id, userId: user.id });

    expect(result).toStrictEqual([
      { kind: "lesson", lessonId: first.id },
      { kind: "lesson", lessonId: second.id },
      { kind: "lesson", lessonId: third.id },
    ]);
  });

  it.each(preloadGenerationStatuses)(
    "returns the next chapter target when the current lesson is last and the chapter is %s",
    async (nextChapterGenerationStatus) => {
      const [user, context] = await Promise.all([userFixture(), createChapterContext()]);

      const [currentLesson, nextChapter] = await Promise.all([
        lessonFixture({
          chapterId: context.chapter.id,
          generationStatus: "completed",
          isPublished: true,
          organizationId: context.organization.id,
          position: 0,
        }),
        chapterFixture({
          courseId: context.chapter.courseId,
          generationStatus: nextChapterGenerationStatus,
          isPublished: true,
          organizationId: context.organization.id,
          position: 1,
        }),
      ]);

      const result = await getNextPreloadTargets({ lessonId: currentLesson.id, userId: user.id });

      expect(result).toStrictEqual([{ chapterId: nextChapter.id, kind: "chapter" }]);
    },
  );

  it.each(nonPreloadGenerationStatuses)(
    "returns no targets when the next lesson generation state is %s",
    async (nextLessonGenerationStatus) => {
      const [user, lessons] = await Promise.all([
        userFixture(),
        createLessonPair({ nextLessonGenerationStatus }),
      ]);

      const result = await getNextPreloadTargets({
        lessonId: lessons.currentLesson.id,
        userId: user.id,
      });

      expect(result).toStrictEqual([]);
    },
  );

  it.each(inaccessibleCurrentLessonCases)(
    "returns null when the current $name is not publicly completable",
    async (testCase) => {
      const [user, lessons] = await Promise.all([
        userFixture(),
        createLessonPair({
          nextLessonGenerationStatus: "pending",
          ...("currentLessonIsPublished" in testCase
            ? { currentLessonIsPublished: testCase.currentLessonIsPublished }
            : {}),
          ...(testCase.visibility ? { visibility: testCase.visibility } : {}),
        }),
      ]);

      const result = await getNextPreloadTargets({
        lessonId: lessons.currentLesson.id,
        userId: user.id,
      });

      expect(result).toStrictEqual([]);
    },
  );

  it("returns no targets for malformed lesson ids before querying UUID columns", async () => {
    const user = await userFixture();

    const result = await getNextPreloadTargets({ lessonId: "not-a-uuid", userId: user.id });

    expect(result).toStrictEqual([]);
  });

  it.each(nonPreloadGenerationStatuses)(
    "returns no targets when the next chapter generation state is %s",
    async (nextChapterGenerationStatus) => {
      const [user, context] = await Promise.all([userFixture(), createChapterContext()]);

      const [currentLesson] = await Promise.all([
        lessonFixture({
          chapterId: context.chapter.id,
          generationStatus: "completed",
          isPublished: true,
          organizationId: context.organization.id,
          position: 0,
        }),
        chapterFixture({
          courseId: context.chapter.courseId,
          generationStatus: nextChapterGenerationStatus,
          isPublished: true,
          organizationId: context.organization.id,
          position: 1,
        }),
      ]);

      const result = await getNextPreloadTargets({ lessonId: currentLesson.id, userId: user.id });

      expect(result).toStrictEqual([]);
    },
  );

  it("skips generated companion lessons inside the three-lesson window", async () => {
    const [user, context] = await Promise.all([userFixture(), createChapterContext()]);

    const lessons = await Promise.all([
      lessonFixture({
        chapterId: context.chapter.id,
        generationStatus: "pending",
        isPublished: true,
        kind: "vocabulary",
        organizationId: context.organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: context.chapter.id,
        generationStatus: "pending",
        isPublished: true,
        kind: "translation",
        organizationId: context.organization.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: context.chapter.id,
        generationStatus: "pending",
        isPublished: true,
        kind: "reading",
        organizationId: context.organization.id,
        position: 2,
      }),
      lessonFixture({
        chapterId: context.chapter.id,
        generationStatus: "pending",
        isPublished: true,
        kind: "grammar",
        organizationId: context.organization.id,
        position: 3,
      }),
    ]);

    const [vocabulary, , reading, grammar] = lessons;

    const result = await getNextPreloadTargets({ lessonId: vocabulary.id, userId: user.id });

    expect(result).toStrictEqual([
      { kind: "lesson", lessonId: reading.id },
      { kind: "lesson", lessonId: grammar.id },
    ]);
  });

  it("adds a next chapter target when fewer than three future lesson rows exist", async () => {
    const [user, context] = await Promise.all([userFixture(), createChapterContext()]);

    const [currentLesson, nextLesson, nextChapter] = await Promise.all([
      lessonFixture({
        chapterId: context.chapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: context.organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: context.chapter.id,
        generationStatus: "pending",
        isPublished: true,
        organizationId: context.organization.id,
        position: 1,
      }),
      chapterFixture({
        courseId: context.chapter.courseId,
        generationStatus: "pending",
        isPublished: true,
        organizationId: context.organization.id,
        position: 1,
      }),
    ]);

    const result = await getNextPreloadTargets({ lessonId: currentLesson.id, userId: user.id });

    expect(result).toStrictEqual([
      { kind: "lesson", lessonId: nextLesson.id },
      { chapterId: nextChapter.id, kind: "chapter" },
    ]);
  });
});
