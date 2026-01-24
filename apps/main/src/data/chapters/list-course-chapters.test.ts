import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { listCourseChapters } from "./list-course-chapters";

describe(listCourseChapters, () => {
  let brandOrg: Awaited<ReturnType<typeof organizationFixture>>;
  let schoolOrg: Awaited<ReturnType<typeof organizationFixture>>;
  let publishedCourse: Awaited<ReturnType<typeof courseFixture>>;
  let draftCourse: Awaited<ReturnType<typeof courseFixture>>;
  let schoolCourse: Awaited<ReturnType<typeof courseFixture>>;
  let publishedChapter1: Awaited<ReturnType<typeof chapterFixture>>;
  let publishedChapter2: Awaited<ReturnType<typeof chapterFixture>>;
  let draftChapter: Awaited<ReturnType<typeof chapterFixture>>;
  let publishedLesson1: Awaited<ReturnType<typeof lessonFixture>>;
  let publishedLesson2: Awaited<ReturnType<typeof lessonFixture>>;
  let draftLesson: Awaited<ReturnType<typeof lessonFixture>>;

  beforeAll(async () => {
    [brandOrg, schoolOrg] = await Promise.all([
      organizationFixture({ kind: "brand" }),
      organizationFixture({ kind: "school" }),
    ]);

    [publishedCourse, draftCourse, schoolCourse] = await Promise.all([
      courseFixture({
        isPublished: true,
        language: "en",
        organizationId: brandOrg.id,
      }),
      courseFixture({
        isPublished: false,
        language: "en",
        organizationId: brandOrg.id,
      }),
      courseFixture({
        isPublished: true,
        language: "en",
        organizationId: schoolOrg.id,
      }),
    ]);

    // Create chapters with different positions
    [publishedChapter1, publishedChapter2, draftChapter] = await Promise.all([
      chapterFixture({
        courseId: publishedCourse.id,
        description: "First chapter",
        isPublished: true,
        language: "en",
        organizationId: brandOrg.id,
        position: 1,
        title: "Chapter 1",
      }),
      chapterFixture({
        courseId: publishedCourse.id,
        description: "Second chapter (but position 0)",
        isPublished: true,
        language: "en",
        organizationId: brandOrg.id,
        position: 0, // Position 0 should come first
        title: "Chapter 2",
      }),
      chapterFixture({
        courseId: publishedCourse.id,
        isPublished: false,
        language: "en",
        organizationId: brandOrg.id,
        position: 2,
        title: "Draft Chapter",
      }),
    ]);

    // Create lessons for publishedChapter1
    [publishedLesson1, publishedLesson2, draftLesson] = await Promise.all([
      lessonFixture({
        chapterId: publishedChapter1.id,
        description: "First lesson",
        isPublished: true,
        language: "en",
        organizationId: brandOrg.id,
        position: 1,
        title: "Lesson 1",
      }),
      lessonFixture({
        chapterId: publishedChapter1.id,
        description: "Second lesson (but position 0)",
        isPublished: true,
        language: "en",
        organizationId: brandOrg.id,
        position: 0, // Position 0 should come first
        title: "Lesson 2",
      }),
      lessonFixture({
        chapterId: publishedChapter1.id,
        isPublished: false,
        language: "en",
        organizationId: brandOrg.id,
        position: 2,
        title: "Draft Lesson",
      }),
    ]);
  });

  test("returns published chapters with published lessons", async () => {
    const result = await listCourseChapters({
      brandSlug: brandOrg.slug,
      courseSlug: publishedCourse.slug,
      language: "en",
    });

    expect(result).toHaveLength(2);

    // Chapter at position 0 should come first
    expect(result[0]?.id).toBe(publishedChapter2.id);
    expect(result[0]?.title).toBe("Chapter 2");
    expect(result[0]?.description).toBe("Second chapter (but position 0)");
    expect(result[0]?.slug).toBe(publishedChapter2.slug);
    expect(result[0]?.position).toBe(0);

    // Chapter at position 1 should come second
    expect(result[1]?.id).toBe(publishedChapter1.id);
    expect(result[1]?.title).toBe("Chapter 1");
  });

  test("includes lessons ordered by position", async () => {
    const result = await listCourseChapters({
      brandSlug: brandOrg.slug,
      courseSlug: publishedCourse.slug,
      language: "en",
    });

    // Chapter at position 1 has lessons
    const chapterWithLessons = result.find((chapter) => chapter.id === publishedChapter1.id);
    expect(chapterWithLessons?.lessons).toHaveLength(2);

    // Lesson at position 0 should come first
    expect(chapterWithLessons?.lessons[0]?.id).toBe(publishedLesson2.id);
    expect(chapterWithLessons?.lessons[0]?.title).toBe("Lesson 2");
    expect(chapterWithLessons?.lessons[0]?.position).toBe(0);

    // Lesson at position 1 should come second
    expect(chapterWithLessons?.lessons[1]?.id).toBe(publishedLesson1.id);
    expect(chapterWithLessons?.lessons[1]?.title).toBe("Lesson 1");
    expect(chapterWithLessons?.lessons[1]?.position).toBe(1);
  });

  test("excludes unpublished chapters", async () => {
    const result = await listCourseChapters({
      brandSlug: brandOrg.slug,
      courseSlug: publishedCourse.slug,
      language: "en",
    });

    const draftChapterInResult = result.find((chapter) => chapter.id === draftChapter.id);
    expect(draftChapterInResult).toBeUndefined();
  });

  test("excludes unpublished lessons within published chapters", async () => {
    const result = await listCourseChapters({
      brandSlug: brandOrg.slug,
      courseSlug: publishedCourse.slug,
      language: "en",
    });

    const chapterWithLessons = result.find((chapter) => chapter.id === publishedChapter1.id);
    const draftLessonInResult = chapterWithLessons?.lessons.find(
      (lesson) => lesson.id === draftLesson.id,
    );
    expect(draftLessonInResult).toBeUndefined();
  });

  test("returns empty array for non-brand organizations", async () => {
    const result = await listCourseChapters({
      brandSlug: schoolOrg.slug,
      courseSlug: schoolCourse.slug,
      language: "en",
    });

    expect(result).toEqual([]);
  });

  test("returns empty array for unpublished course", async () => {
    const result = await listCourseChapters({
      brandSlug: brandOrg.slug,
      courseSlug: draftCourse.slug,
      language: "en",
    });

    expect(result).toEqual([]);
  });

  test("filters by language correctly", async () => {
    const ptCourse = await courseFixture({
      isPublished: true,
      language: "pt",
      organizationId: brandOrg.id,
    });

    await chapterFixture({
      courseId: ptCourse.id,
      isPublished: true,
      language: "pt",
      organizationId: brandOrg.id,
      position: 0,
      title: "Portuguese Chapter",
    });

    const enResult = await listCourseChapters({
      brandSlug: brandOrg.slug,
      courseSlug: ptCourse.slug,
      language: "en",
    });

    const ptResult = await listCourseChapters({
      brandSlug: brandOrg.slug,
      courseSlug: ptCourse.slug,
      language: "pt",
    });

    expect(enResult).toEqual([]);
    expect(ptResult).toHaveLength(1);
    expect(ptResult[0]?.title).toBe("Portuguese Chapter");
  });

  test("returns empty array when no chapters exist", async () => {
    const courseWithoutChapters = await courseFixture({
      isPublished: true,
      language: "en",
      organizationId: brandOrg.id,
    });

    const result = await listCourseChapters({
      brandSlug: brandOrg.slug,
      courseSlug: courseWithoutChapters.slug,
      language: "en",
    });

    expect(result).toEqual([]);
  });

  test("returns empty array when brandSlug does not match", async () => {
    const otherBrandOrg = await organizationFixture({ kind: "brand" });

    const result = await listCourseChapters({
      brandSlug: otherBrandOrg.slug,
      courseSlug: publishedCourse.slug,
      language: "en",
    });

    expect(result).toEqual([]);
  });
});
