import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { getLesson } from "./get-lesson";

describe("getLesson", () => {
  let brandOrg: Awaited<ReturnType<typeof organizationFixture>>;
  let schoolOrg: Awaited<ReturnType<typeof organizationFixture>>;
  let publishedCourse: Awaited<ReturnType<typeof courseFixture>>;
  let publishedChapter: Awaited<ReturnType<typeof chapterFixture>>;
  let publishedLesson: Awaited<ReturnType<typeof lessonFixture>>;
  let draftLesson: Awaited<ReturnType<typeof lessonFixture>>;
  let schoolLesson: Awaited<ReturnType<typeof lessonFixture>>;

  beforeAll(async () => {
    [brandOrg, schoolOrg] = await Promise.all([
      organizationFixture({ kind: "brand" }),
      organizationFixture({ kind: "school" }),
    ]);

    const [brandCourse, schoolCourse] = await Promise.all([
      courseFixture({
        isPublished: true,
        language: "en",
        organizationId: brandOrg.id,
      }),
      courseFixture({
        isPublished: true,
        language: "en",
        organizationId: schoolOrg.id,
      }),
    ]);

    publishedCourse = brandCourse;

    const [brandChapter, schoolChapter] = await Promise.all([
      chapterFixture({
        courseId: brandCourse.id,
        isPublished: true,
        language: "en",
        organizationId: brandOrg.id,
      }),
      chapterFixture({
        courseId: schoolCourse.id,
        isPublished: true,
        language: "en",
        organizationId: schoolOrg.id,
      }),
    ]);

    publishedChapter = brandChapter;

    [publishedLesson, draftLesson, schoolLesson] = await Promise.all([
      lessonFixture({
        chapterId: brandChapter.id,
        isPublished: true,
        language: "en",
        organizationId: brandOrg.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: brandChapter.id,
        isPublished: false,
        language: "en",
        organizationId: brandOrg.id,
        position: 2,
      }),
      lessonFixture({
        chapterId: schoolChapter.id,
        isPublished: true,
        language: "en",
        organizationId: schoolOrg.id,
        position: 1,
      }),
    ]);
  });

  test("returns lesson with chapter and course info", async () => {
    const result = await getLesson({
      brandSlug: brandOrg.slug,
      chapterSlug: publishedChapter.slug,
      courseSlug: publishedCourse.slug,
      lessonSlug: publishedLesson.slug,
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe(publishedLesson.id);
    expect(result?.title).toBe(publishedLesson.title);
    expect(result?.description).toBe(publishedLesson.description);
    expect(result?.position).toBe(publishedLesson.position);
    expect(result?.chapter.slug).toBe(publishedChapter.slug);
    expect(result?.chapter.title).toBe(publishedChapter.title);
    expect(result?.chapter.course.slug).toBe(publishedCourse.slug);
    expect(result?.chapter.course.title).toBe(publishedCourse.title);
  });

  test("returns null for non-existent lesson", async () => {
    const result = await getLesson({
      brandSlug: brandOrg.slug,
      chapterSlug: publishedChapter.slug,
      courseSlug: publishedCourse.slug,
      lessonSlug: "non-existent-lesson",
    });

    expect(result).toBeNull();
  });

  test("returns null for unpublished lesson", async () => {
    const result = await getLesson({
      brandSlug: brandOrg.slug,
      chapterSlug: publishedChapter.slug,
      courseSlug: publishedCourse.slug,
      lessonSlug: draftLesson.slug,
    });

    expect(result).toBeNull();
  });

  test("returns null for lesson in unpublished chapter", async () => {
    const draftChapter = await chapterFixture({
      courseId: publishedCourse.id,
      isPublished: false,
      language: "en",
      organizationId: brandOrg.id,
    });

    const lessonInDraftChapter = await lessonFixture({
      chapterId: draftChapter.id,
      isPublished: true,
      language: "en",
      organizationId: brandOrg.id,
    });

    const result = await getLesson({
      brandSlug: brandOrg.slug,
      chapterSlug: draftChapter.slug,
      courseSlug: publishedCourse.slug,
      lessonSlug: lessonInDraftChapter.slug,
    });

    expect(result).toBeNull();
  });

  test("returns null for lesson in unpublished course", async () => {
    const draftCourse = await courseFixture({
      isPublished: false,
      language: "en",
      organizationId: brandOrg.id,
    });

    const chapterInDraftCourse = await chapterFixture({
      courseId: draftCourse.id,
      isPublished: true,
      language: "en",
      organizationId: brandOrg.id,
    });

    const lessonInDraftCourse = await lessonFixture({
      chapterId: chapterInDraftCourse.id,
      isPublished: true,
      language: "en",
      organizationId: brandOrg.id,
    });

    const result = await getLesson({
      brandSlug: brandOrg.slug,
      chapterSlug: chapterInDraftCourse.slug,
      courseSlug: draftCourse.slug,
      lessonSlug: lessonInDraftCourse.slug,
    });

    expect(result).toBeNull();
  });

  test("returns null for lesson from non-brand org", async () => {
    const schoolChapter = await chapterFixture({
      courseId: (
        await courseFixture({
          isPublished: true,
          language: "en",
          organizationId: schoolOrg.id,
        })
      ).id,
      isPublished: true,
      language: "en",
      organizationId: schoolOrg.id,
    });

    const result = await getLesson({
      brandSlug: schoolOrg.slug,
      chapterSlug: schoolChapter.slug,
      courseSlug: schoolChapter.slug,
      lessonSlug: schoolLesson.slug,
    });

    expect(result).toBeNull();
  });

  test("returns null when brandSlug does not match", async () => {
    const otherBrandOrg = await organizationFixture({ kind: "brand" });

    const result = await getLesson({
      brandSlug: otherBrandOrg.slug,
      chapterSlug: publishedChapter.slug,
      courseSlug: publishedCourse.slug,
      lessonSlug: publishedLesson.slug,
    });

    expect(result).toBeNull();
  });
});
