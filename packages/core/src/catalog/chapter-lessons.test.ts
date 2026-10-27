import { courseChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { catalogCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { beforeEach, describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { listCatalogChapterLessons } from "./chapter-lessons";

describe(listCatalogChapterLessons, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("lists the chapter's visible lessons in order with their content state", async () => {
    const { chapters, course, lessons } = await catalogCourseFixture({ lessonCounts: [2] });

    const chapter = chapters[0]!;

    const pending = await libraryLessonFixture({ contentStatus: "running" });

    await chapterLessonFixture({ chapterId: chapter.id, lessonId: pending.id, position: 2 });

    const result = await listCatalogChapterLessons({ chapterId: chapter.id });

    expect(result?.chapterId).toBe(chapter.id);
    expect(result?.courseId).toBe(course.id);

    expect(
      result?.lessons.map((lesson) => ({
        contentStatus: lesson.contentStatus,
        id: lesson.id,
        position: lesson.position,
      })),
    ).toStrictEqual([
      { contentStatus: "completed", id: lessons[0]![0]!.id, position: 0 },
      { contentStatus: "completed", id: lessons[0]![1]!.id, position: 1 },
      { contentStatus: "running", id: pending.id, position: 2 },
    ]);
  });

  it("carries the course the chapter is read in", async () => {
    const [home, other, unrelated] = await Promise.all([
      catalogCourseFixture({ lessonCounts: [1] }),
      catalogCourseFixture({ lessonCounts: [] }),
      catalogCourseFixture({ lessonCounts: [] }),
    ]);

    const chapter = home.chapters[0]!;

    await courseChapterFixture({ chapterId: chapter.id, courseId: other.course.id });

    const [inOther, outside] = await Promise.all([
      listCatalogChapterLessons({ chapterId: chapter.id, courseId: other.course.id }),
      listCatalogChapterLessons({ chapterId: chapter.id, courseId: unrelated.course.id }),
    ]);

    expect(inOther).toMatchObject({
      chapterId: chapter.id,
      courseId: other.course.id,
      lessons: [{ id: home.lessons[0]![0]!.id, position: 0 }],
    });

    expect(outside).toBeNull();
  });
});
