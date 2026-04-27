import { describe, expect, test } from "vitest";
import { type PublishedLessonCompletionRow } from "./durable-curriculum-completion-queries";
import {
  getEffectiveDurableChapterIds,
  getEffectiveDurableLessonIds,
  getLessonRow,
  groupRowsByChapter,
  isCurrentChapterCompleted,
  isCurrentCourseCompleted,
  isCurrentLessonCompleted,
} from "./durable-curriculum-completion-rules";

function createTestUuid(id: number): string {
  return `00000000-0000-7000-8000-${String(id).padStart(12, "0")}`;
}

/**
 * These rule tests only care about lesson/chapter completion counts, so this
 * helper builds the smallest row shape that still exercises the pure logic.
 */
function createRow(
  overrides: Partial<PublishedLessonCompletionRow> = {},
): PublishedLessonCompletionRow {
  return {
    chapterId: createTestUuid(1),
    completedActivities: 0,
    lessonId: createTestUuid(101),
    totalActivities: 1,
    ...overrides,
  };
}

/**
 * Course completion only reads chapter ids from the published chapter list.
 * Returning the full inferred type keeps the tests aligned with the real
 * function signature without needing database fixtures.
 */
function createChapters(ids: string[]): Parameters<typeof isCurrentCourseCompleted>[0]["chapters"] {
  return ids.map((id, index) => ({
    archivedAt: null,
    courseId: createTestUuid(900),
    createdAt: new Date(),
    description: `Description ${id}`,
    generationRunId: null,
    generationStatus: "completed" as const,
    id,
    isLocked: false,
    isPublished: true,
    language: "en",
    normalizedTitle: `chapter ${id}`,
    organizationId: createTestUuid(901),
    position: index,
    slug: `chapter-${id}`,
    title: `Chapter ${id}`,
    updatedAt: new Date(),
  }));
}

describe("durable curriculum completion rules", () => {
  test("isCurrentLessonCompleted requires at least one activity and all of them completed", () => {
    expect(
      isCurrentLessonCompleted({
        row: createRow({ completedActivities: 0, totalActivities: 0 }),
      }),
    ).toBe(false);
    expect(
      isCurrentLessonCompleted({
        row: createRow({ completedActivities: 1, totalActivities: 2 }),
      }),
    ).toBe(false);
    expect(
      isCurrentLessonCompleted({
        row: createRow({ completedActivities: 2, totalActivities: 2 }),
      }),
    ).toBe(true);
  });

  test("groupRowsByChapter groups rows by chapter id", () => {
    const chapter1 = createTestUuid(1);
    const chapter2 = createTestUuid(2);
    const lesson10 = createTestUuid(10);
    const lesson11 = createTestUuid(11);
    const lesson20 = createTestUuid(20);
    const rows = [
      createRow({ chapterId: chapter1, lessonId: lesson10 }),
      createRow({ chapterId: chapter1, lessonId: lesson11 }),
      createRow({ chapterId: chapter2, lessonId: lesson20 }),
    ];

    const grouped = groupRowsByChapter({ rows });

    expect(grouped.get(chapter1)?.map((row) => row.lessonId)).toEqual([lesson10, lesson11]);
    expect(grouped.get(chapter2)?.map((row) => row.lessonId)).toEqual([lesson20]);
  });

  test("getLessonRow returns the matching lesson or null", () => {
    const lesson10 = createTestUuid(10);
    const lesson11 = createTestUuid(11);
    const missingLesson = createTestUuid(99);
    const rows = [createRow({ lessonId: lesson10 }), createRow({ lessonId: lesson11 })];

    expect(getLessonRow({ lessonId: lesson11, rows })?.lessonId).toBe(lesson11);
    expect(getLessonRow({ lessonId: missingLesson, rows })).toBeNull();
  });

  test("getEffectiveDurableLessonIds adds the current lesson only when it is complete", () => {
    const durableLessonId = createTestUuid(3);
    const currentLessonId = createTestUuid(9);
    const durableLessonIds = new Set([durableLessonId]);

    expect(
      getEffectiveDurableLessonIds({
        durableLessonIds,
        lessonRow: createRow({
          completedActivities: 1,
          lessonId: currentLessonId,
          totalActivities: 1,
        }),
      }),
    ).toEqual(new Set([durableLessonId, currentLessonId]));

    expect(
      getEffectiveDurableLessonIds({
        durableLessonIds,
        lessonRow: createRow({
          completedActivities: 0,
          lessonId: currentLessonId,
          totalActivities: 1,
        }),
      }),
    ).toBe(durableLessonIds);
  });

  test("isCurrentChapterCompleted accepts direct or durable lesson completion but rejects empty chapters", () => {
    const chapterId = createTestUuid(1);
    const lesson10 = createTestUuid(10);
    const lesson11 = createTestUuid(11);
    const missingChapterId = createTestUuid(99);
    const rowsByChapter = groupRowsByChapter({
      rows: [
        createRow({
          chapterId,
          completedActivities: 1,
          lessonId: lesson10,
          totalActivities: 1,
        }),
        createRow({
          chapterId,
          completedActivities: 0,
          lessonId: lesson11,
          totalActivities: 2,
        }),
      ],
    });

    expect(
      isCurrentChapterCompleted({
        chapterId,
        durableLessonIds: new Set([lesson11]),
        rowsByChapter,
      }),
    ).toBe(true);

    expect(
      isCurrentChapterCompleted({
        chapterId,
        durableLessonIds: new Set(),
        rowsByChapter,
      }),
    ).toBe(false);

    expect(
      isCurrentChapterCompleted({
        chapterId: missingChapterId,
        durableLessonIds: new Set(),
        rowsByChapter,
      }),
    ).toBe(false);
  });

  test("getEffectiveDurableChapterIds adds the current chapter only when it is complete", () => {
    const durableChapterId = createTestUuid(2);
    const currentChapterId = createTestUuid(5);
    const durableChapterIds = new Set([durableChapterId]);

    expect(
      getEffectiveDurableChapterIds({
        chapterId: currentChapterId,
        durableChapterIds,
        isChapterCompleted: true,
      }),
    ).toEqual(new Set([durableChapterId, currentChapterId]));

    expect(
      getEffectiveDurableChapterIds({
        chapterId: currentChapterId,
        durableChapterIds,
        isChapterCompleted: false,
      }),
    ).toBe(durableChapterIds);
  });

  test("isCurrentCourseCompleted requires every chapter to be covered by durable or effective completion", () => {
    const chapter1 = createTestUuid(1);
    const chapter2 = createTestUuid(2);
    const chapter3 = createTestUuid(3);
    const lesson10 = createTestUuid(10);
    const lesson20 = createTestUuid(20);
    const rowsByChapter = groupRowsByChapter({
      rows: [
        createRow({
          chapterId: chapter1,
          completedActivities: 1,
          lessonId: lesson10,
          totalActivities: 1,
        }),
        createRow({
          chapterId: chapter2,
          completedActivities: 0,
          lessonId: lesson20,
          totalActivities: 2,
        }),
      ],
    });

    expect(
      isCurrentCourseCompleted({
        chapters: createChapters([chapter1, chapter2]),
        durableChapterIds: new Set([chapter2]),
        durableLessonIds: new Set(),
        rowsByChapter,
      }),
    ).toBe(true);

    expect(
      isCurrentCourseCompleted({
        chapters: createChapters([chapter1, chapter2, chapter3]),
        durableChapterIds: new Set([chapter2]),
        durableLessonIds: new Set(),
        rowsByChapter,
      }),
    ).toBe(false);

    expect(
      isCurrentCourseCompleted({
        chapters: [],
        durableChapterIds: new Set(),
        durableLessonIds: new Set(),
        rowsByChapter: new Map(),
      }),
    ).toBe(false);
  });

  test("isCurrentCourseCompleted can finish a course through durable lessons without a chapter badge yet", () => {
    const chapter1 = createTestUuid(1);
    const chapter2 = createTestUuid(2);
    const lesson10 = createTestUuid(10);
    const lesson20 = createTestUuid(20);
    const rowsByChapter = groupRowsByChapter({
      rows: [
        createRow({
          chapterId: chapter1,
          completedActivities: 1,
          lessonId: lesson10,
          totalActivities: 1,
        }),
        createRow({
          chapterId: chapter2,
          completedActivities: 0,
          lessonId: lesson20,
          totalActivities: 2,
        }),
      ],
    });

    expect(
      isCurrentCourseCompleted({
        chapters: createChapters([chapter1, chapter2]),
        durableChapterIds: new Set(),
        durableLessonIds: new Set([lesson20]),
        rowsByChapter,
      }),
    ).toBe(true);
  });
});
