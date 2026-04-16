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

/**
 * These rule tests only care about lesson/chapter completion counts, so this
 * helper builds the smallest row shape that still exercises the pure logic.
 */
function createRow(
  overrides: Partial<PublishedLessonCompletionRow> = {},
): PublishedLessonCompletionRow {
  return {
    chapterId: 1,
    completedActivities: 0,
    lessonId: 1,
    totalActivities: 1,
    ...overrides,
  };
}

/**
 * Course completion only reads chapter ids from the published chapter list.
 * Returning the full inferred type keeps the tests aligned with the real
 * function signature without needing database fixtures.
 */
function createChapters(ids: number[]): Parameters<typeof isCurrentCourseCompleted>[0]["chapters"] {
  return ids.map((id) => ({
    archivedAt: null,
    courseId: 1,
    createdAt: new Date(),
    description: `Description ${id}`,
    generationRunId: null,
    generationStatus: "completed" as const,
    id,
    isLocked: false,
    isPublished: true,
    language: "en",
    managementMode: "manual" as const,
    normalizedTitle: `chapter ${id}`,
    organizationId: `org-${id}`,
    position: id - 1,
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
    const rows = [
      createRow({ chapterId: 1, lessonId: 10 }),
      createRow({ chapterId: 1, lessonId: 11 }),
      createRow({ chapterId: 2, lessonId: 20 }),
    ];

    const grouped = groupRowsByChapter({ rows });

    expect(grouped.get(1)?.map((row) => row.lessonId)).toEqual([10, 11]);
    expect(grouped.get(2)?.map((row) => row.lessonId)).toEqual([20]);
  });

  test("getLessonRow returns the matching lesson or null", () => {
    const rows = [createRow({ lessonId: 10 }), createRow({ lessonId: 11 })];

    expect(getLessonRow({ lessonId: 11, rows })?.lessonId).toBe(11);
    expect(getLessonRow({ lessonId: 99, rows })).toBeNull();
  });

  test("getEffectiveDurableLessonIds adds the current lesson only when it is complete", () => {
    const durableLessonIds = new Set([3]);

    expect(
      getEffectiveDurableLessonIds({
        durableLessonIds,
        lessonRow: createRow({ completedActivities: 1, lessonId: 9, totalActivities: 1 }),
      }),
    ).toEqual(new Set([3, 9]));

    expect(
      getEffectiveDurableLessonIds({
        durableLessonIds,
        lessonRow: createRow({ completedActivities: 0, lessonId: 9, totalActivities: 1 }),
      }),
    ).toBe(durableLessonIds);
  });

  test("isCurrentChapterCompleted accepts direct or durable lesson completion but rejects empty chapters", () => {
    const rowsByChapter = groupRowsByChapter({
      rows: [
        createRow({ chapterId: 1, completedActivities: 1, lessonId: 10, totalActivities: 1 }),
        createRow({ chapterId: 1, completedActivities: 0, lessonId: 11, totalActivities: 2 }),
      ],
    });

    expect(
      isCurrentChapterCompleted({
        chapterId: 1,
        durableLessonIds: new Set([11]),
        rowsByChapter,
      }),
    ).toBe(true);

    expect(
      isCurrentChapterCompleted({
        chapterId: 1,
        durableLessonIds: new Set(),
        rowsByChapter,
      }),
    ).toBe(false);

    expect(
      isCurrentChapterCompleted({
        chapterId: 99,
        durableLessonIds: new Set(),
        rowsByChapter,
      }),
    ).toBe(false);
  });

  test("getEffectiveDurableChapterIds adds the current chapter only when it is complete", () => {
    const durableChapterIds = new Set([2]);

    expect(
      getEffectiveDurableChapterIds({
        chapterId: 5,
        durableChapterIds,
        isChapterCompleted: true,
      }),
    ).toEqual(new Set([2, 5]));

    expect(
      getEffectiveDurableChapterIds({
        chapterId: 5,
        durableChapterIds,
        isChapterCompleted: false,
      }),
    ).toBe(durableChapterIds);
  });

  test("isCurrentCourseCompleted requires every chapter to be covered by durable or effective completion", () => {
    const rowsByChapter = groupRowsByChapter({
      rows: [
        createRow({ chapterId: 1, completedActivities: 1, lessonId: 10, totalActivities: 1 }),
        createRow({ chapterId: 2, completedActivities: 0, lessonId: 20, totalActivities: 2 }),
      ],
    });

    expect(
      isCurrentCourseCompleted({
        chapters: createChapters([1, 2]),
        durableChapterIds: new Set([2]),
        durableLessonIds: new Set(),
        rowsByChapter,
      }),
    ).toBe(true);

    expect(
      isCurrentCourseCompleted({
        chapters: createChapters([1, 2, 3]),
        durableChapterIds: new Set([2]),
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
    const rowsByChapter = groupRowsByChapter({
      rows: [
        createRow({ chapterId: 1, completedActivities: 1, lessonId: 10, totalActivities: 1 }),
        createRow({ chapterId: 2, completedActivities: 0, lessonId: 20, totalActivities: 2 }),
      ],
    });

    expect(
      isCurrentCourseCompleted({
        chapters: createChapters([1, 2]),
        durableChapterIds: new Set(),
        durableLessonIds: new Set([20]),
        rowsByChapter,
      }),
    ).toBe(true);
  });
});
