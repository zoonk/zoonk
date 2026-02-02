import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { listChapterLessons } from "./list-chapter-lessons";

describe(listChapterLessons, () => {
  let brandOrg: Awaited<ReturnType<typeof organizationFixture>>;
  let publishedCourse: Awaited<ReturnType<typeof courseFixture>>;
  let publishedChapter: Awaited<ReturnType<typeof chapterFixture>>;
  let emptyChapter: Awaited<ReturnType<typeof chapterFixture>>;
  let publishedLesson1: Awaited<ReturnType<typeof lessonFixture>>;
  let publishedLesson2: Awaited<ReturnType<typeof lessonFixture>>;
  let draftLesson: Awaited<ReturnType<typeof lessonFixture>>;

  beforeAll(async () => {
    brandOrg = await organizationFixture({ kind: "brand" });

    publishedCourse = await courseFixture({
      isPublished: true,
      language: "en",
      organizationId: brandOrg.id,
    });

    [publishedChapter, emptyChapter] = await Promise.all([
      chapterFixture({
        courseId: publishedCourse.id,
        isPublished: true,
        language: "en",
        organizationId: brandOrg.id,
      }),
      chapterFixture({
        courseId: publishedCourse.id,
        isPublished: true,
        language: "en",
        organizationId: brandOrg.id,
      }),
    ]);

    [publishedLesson1, publishedLesson2, draftLesson] = await Promise.all([
      lessonFixture({
        chapterId: publishedChapter.id,
        description: "First lesson description",
        isPublished: true,
        language: "en",
        organizationId: brandOrg.id,
        position: 1,
        title: "First Lesson",
      }),
      lessonFixture({
        chapterId: publishedChapter.id,
        description: "Second lesson (position 0)",
        isPublished: true,
        language: "en",
        organizationId: brandOrg.id,
        position: 0,
        title: "Second Lesson",
      }),
      lessonFixture({
        chapterId: publishedChapter.id,
        isPublished: false,
        language: "en",
        organizationId: brandOrg.id,
        position: 2,
        title: "Draft Lesson",
      }),
    ]);
  });

  test("returns published lessons ordered by position", async () => {
    const result = await listChapterLessons({ chapterId: publishedChapter.id });

    expect(result).toHaveLength(2);

    // Position 0 should come first
    expect(result[0]?.id).toBe(publishedLesson2.id);
    expect(result[0]?.slug).toBe(publishedLesson2.slug);
    expect(result[0]?.title).toBe("Second Lesson");
    expect(result[0]?.description).toBe("Second lesson (position 0)");
    expect(result[0]?.position).toBe(0);

    // Position 1 should come second
    expect(result[1]?.id).toBe(publishedLesson1.id);
    expect(result[1]?.title).toBe("First Lesson");
    expect(result[1]?.position).toBe(1);
  });

  test("excludes unpublished lessons", async () => {
    const result = await listChapterLessons({ chapterId: publishedChapter.id });

    const draftLessonInResult = result.find((lesson) => lesson.id === draftLesson.id);
    expect(draftLessonInResult).toBeUndefined();
  });

  test("returns empty array when chapter has no lessons", async () => {
    const result = await listChapterLessons({ chapterId: emptyChapter.id });

    expect(result).toEqual([]);
  });

  test("returns empty array for non-existent chapter", async () => {
    const result = await listChapterLessons({ chapterId: 999_999 });

    expect(result).toEqual([]);
  });

  test("returns all lesson fields correctly", async () => {
    const result = await listChapterLessons({ chapterId: publishedChapter.id });

    const lesson = result.find((item) => item.id === publishedLesson1.id);
    expect(lesson).toBeDefined();
    expect(lesson).toHaveProperty("id");
    expect(lesson).toHaveProperty("slug");
    expect(lesson).toHaveProperty("title");
    expect(lesson).toHaveProperty("description");
    expect(lesson).toHaveProperty("position");
  });
});
