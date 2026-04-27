import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { listCourseChapters } from "./list-course-chapters";

describe(listCourseChapters, () => {
  let brandOrg: Awaited<ReturnType<typeof organizationFixture>>;
  let publishedCourse: Awaited<ReturnType<typeof courseFixture>>;
  let publishedChapter1: Awaited<ReturnType<typeof chapterFixture>>;
  let publishedChapter2: Awaited<ReturnType<typeof chapterFixture>>;
  let draftChapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    brandOrg = await organizationFixture({ kind: "brand" });

    publishedCourse = await courseFixture({
      isPublished: true,
      language: "en",
      organizationId: brandOrg.id,
    });

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
        position: 0,
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
  });

  test("returns published chapters ordered by position", async () => {
    const result = await listCourseChapters({ courseId: publishedCourse.id });

    expect(result).toHaveLength(2);

    // Chapter at position 0 should come first
    expect(result[0]?.id).toBe(publishedChapter2.id);
    expect(result[0]?.description).toBe("Second chapter (but position 0)");
    expect(result[0]?.slug).toBe(publishedChapter2.slug);
    expect(result[0]?.position).toBe(0);
    expect(result[0]?.generationStatus).toBeDefined();

    // Chapter at position 1 should come second
    expect(result[1]?.id).toBe(publishedChapter1.id);
    expect(result[1]?.title).toBe("Chapter 1");
  });

  test("excludes unpublished chapters", async () => {
    const result = await listCourseChapters({ courseId: publishedCourse.id });

    const draftChapterInResult = result.find((chapter) => chapter.id === draftChapter.id);
    expect(draftChapterInResult).toBeUndefined();
  });

  test("returns empty array when no chapters exist", async () => {
    const courseWithoutChapters = await courseFixture({
      isPublished: true,
      language: "en",
      organizationId: brandOrg.id,
    });

    const result = await listCourseChapters({ courseId: courseWithoutChapters.id });

    expect(result).toEqual([]);
  });
});
