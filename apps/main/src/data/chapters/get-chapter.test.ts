import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, it } from "vitest";
import { getChapter } from "./get-chapter";

describe(getChapter, () => {
  let brandOrg: Awaited<ReturnType<typeof organizationFixture>>;
  let schoolOrg: Awaited<ReturnType<typeof organizationFixture>>;
  let publishedCourse: Awaited<ReturnType<typeof courseFixture>>;
  let publishedChapter: Awaited<ReturnType<typeof chapterFixture>>;
  let draftChapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    [brandOrg, schoolOrg] = await Promise.all([
      organizationFixture({ kind: "brand" }),
      organizationFixture({ kind: "school" }),
    ]);

    const [brandCourse] = await Promise.all([
      courseFixture({ isPublished: true, language: "en", organizationId: brandOrg.id }),
      courseFixture({ isPublished: true, language: "en", organizationId: schoolOrg.id }),
    ]);

    publishedCourse = brandCourse;

    [publishedChapter, draftChapter] = await Promise.all([
      chapterFixture({
        courseId: brandCourse.id,
        description: "Test chapter description",
        isPublished: true,
        language: "en",
        organizationId: brandOrg.id,
        position: 0,
        title: "Test Chapter",
      }),
      chapterFixture({
        courseId: brandCourse.id,
        isPublished: false,
        language: "en",
        organizationId: brandOrg.id,
        position: 1,
      }),
    ]);
  });

  it("returns chapter with course info", async () => {
    const result = await getChapter({
      brandSlug: brandOrg.slug,
      chapterSlug: publishedChapter.slug,
      courseSlug: publishedCourse.slug,
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe(publishedChapter.id);
    expect(result?.slug).toBe(publishedChapter.slug);
    expect(result?.title).toBe("Test Chapter");
    expect(result?.description).toBe("Test chapter description");
    expect(result?.position).toBe(0);
    expect(result?.course.slug).toBe(publishedCourse.slug);
    expect(result?.course.title).toBe(publishedCourse.title);
  });

  it("returns chapter when route slugs are percent-encoded", async () => {
    const course = await courseFixture({
      isPublished: true,
      language: "pt-BR",
      organizationId: brandOrg.id,
      slug: `japones-${crypto.randomUUID()}-日本語`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      language: "pt-BR",
      organizationId: brandOrg.id,
      slug: `hiragana-${crypto.randomUUID()}-あいう`,
    });

    const result = await getChapter({
      brandSlug: brandOrg.slug,
      chapterSlug: encodeURIComponent(chapter.slug),
      courseSlug: encodeURIComponent(course.slug),
    });

    expect(result?.id).toBe(chapter.id);
  });

  it("returns null for non-existent chapter", async () => {
    const result = await getChapter({
      brandSlug: brandOrg.slug,
      chapterSlug: "non-existent-chapter",
      courseSlug: publishedCourse.slug,
    });

    expect(result).toBeNull();
  });

  it("returns null for unpublished chapter", async () => {
    const result = await getChapter({
      brandSlug: brandOrg.slug,
      chapterSlug: draftChapter.slug,
      courseSlug: publishedCourse.slug,
    });

    expect(result).toBeNull();
  });

  it("returns null for chapter in unpublished course", async () => {
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

    const result = await getChapter({
      brandSlug: brandOrg.slug,
      chapterSlug: chapterInDraftCourse.slug,
      courseSlug: draftCourse.slug,
    });

    expect(result).toBeNull();
  });

  it("returns null for chapter from non-brand org", async () => {
    const schoolCourse = await courseFixture({
      isPublished: true,
      language: "en",
      organizationId: schoolOrg.id,
    });

    const schoolChapter = await chapterFixture({
      courseId: schoolCourse.id,
      isPublished: true,
      language: "en",
      organizationId: schoolOrg.id,
    });

    const result = await getChapter({
      brandSlug: schoolOrg.slug,
      chapterSlug: schoolChapter.slug,
      courseSlug: schoolCourse.slug,
    });

    expect(result).toBeNull();
  });

  it("returns null when brandSlug does not match", async () => {
    const otherBrandOrg = await organizationFixture({ kind: "brand" });

    const result = await getChapter({
      brandSlug: otherBrandOrg.slug,
      chapterSlug: publishedChapter.slug,
      courseSlug: publishedCourse.slug,
    });

    expect(result).toBeNull();
  });

  it("returns null when courseSlug does not match", async () => {
    const result = await getChapter({
      brandSlug: brandOrg.slug,
      chapterSlug: publishedChapter.slug,
      courseSlug: "non-existent-course",
    });

    expect(result).toBeNull();
  });
});
