import { randomUUID } from "node:crypto";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { normalizeString } from "@zoonk/utils/string";
import { beforeAll, describe, expect, it } from "vitest";
import { searchChapters } from "./search-chapters";

describe(searchChapters, () => {
  let brandOrg: Awaited<ReturnType<typeof organizationFixture>>;
  let schoolOrg: Awaited<ReturnType<typeof organizationFixture>>;
  let publishedCourse: Awaited<ReturnType<typeof courseFixture>>;
  let draftCourse: Awaited<ReturnType<typeof courseFixture>>;
  let schoolCourse: Awaited<ReturnType<typeof courseFixture>>;

  beforeAll(async () => {
    [brandOrg, schoolOrg] = await Promise.all([
      organizationFixture({ kind: "brand" }),
      organizationFixture({ kind: "school" }),
    ]);

    [publishedCourse, draftCourse, schoolCourse] = await Promise.all([
      courseFixture({ isPublished: true, organizationId: brandOrg.id }),
      courseFixture({ isPublished: false, organizationId: brandOrg.id }),
      courseFixture({ isPublished: true, organizationId: schoolOrg.id }),
    ]);
  });

  it("returns chapters matching partial titles and descriptions", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const titleSearchTerm = `chaptertitle${uniqueId}`;
    const descriptionSearchTerm = `chapterdescription${uniqueId}`;

    const [titleMatch, descriptionMatch] = await Promise.all([
      chapterFixture({
        courseId: publishedCourse.id,
        description: `Teaches a different topic ${uniqueId}`,
        isPublished: true,
        normalizedTitle: normalizeString(`Advanced ${titleSearchTerm}`),
        organizationId: brandOrg.id,
        title: `Advanced ${titleSearchTerm}`,
      }),
      chapterFixture({
        courseId: publishedCourse.id,
        description: `Teaches ${descriptionSearchTerm} without using it in the title`,
        isPublished: true,
        normalizedTitle: normalizeString(`Unrelated chapter ${uniqueId}`),
        organizationId: brandOrg.id,
        title: `Unrelated chapter ${uniqueId}`,
      }),
    ]);

    const titleResult = await searchChapters({ language: "en", query: titleSearchTerm });

    const descriptionResult = await searchChapters({
      language: "en",
      query: descriptionSearchTerm,
    });

    expect(titleResult.map((chapter) => chapter.id)).toContain(titleMatch.id);
    expect(descriptionResult.map((chapter) => chapter.id)).toContain(descriptionMatch.id);
  });

  it("returns exact chapter title matches first", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const searchTerm = `chapterexact${uniqueId}`;

    const [descriptionMatch, partialTitleMatch, exactTitleMatch] = await Promise.all([
      chapterFixture({
        courseId: publishedCourse.id,
        description: `Mentions ${searchTerm} in the description`,
        isPublished: true,
        normalizedTitle: normalizeString(`Description only ${uniqueId}`),
        organizationId: brandOrg.id,
        title: `Description only ${uniqueId}`,
      }),
      chapterFixture({
        courseId: publishedCourse.id,
        description: `Partial title match ${uniqueId}`,
        isPublished: true,
        normalizedTitle: normalizeString(`Advanced ${searchTerm}`),
        organizationId: brandOrg.id,
        title: `Advanced ${searchTerm}`,
      }),
      chapterFixture({
        courseId: publishedCourse.id,
        description: `Exact title match ${uniqueId}`,
        isPublished: true,
        normalizedTitle: normalizeString(searchTerm),
        organizationId: brandOrg.id,
        title: searchTerm,
      }),
    ]);

    const result = await searchChapters({ language: "en", query: searchTerm });
    const ids = result.map((chapter) => chapter.id);

    expect(ids).toContain(descriptionMatch.id);
    expect(ids).toContain(partialTitleMatch.id);
    expect(ids).toContain(exactTitleMatch.id);
    expect(result[0]?.id).toBe(exactTitleMatch.id);
  });

  it("limits chapter results to five by default", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const searchTerm = `chapterlimit${uniqueId}`;
    const course = await courseFixture({ isPublished: true, organizationId: brandOrg.id });

    await Promise.all(
      Array.from({ length: 7 }, (_, index) =>
        chapterFixture({
          courseId: course.id,
          description: `Limit test chapter ${index}`,
          isPublished: true,
          normalizedTitle: normalizeString(`${searchTerm} ${index}`),
          organizationId: brandOrg.id,
          position: index,
          slug: `chapter-limit-${uniqueId}-${index}`,
          title: `${searchTerm} ${index}`,
        }),
      ),
    );

    const result = await searchChapters({ language: "en", query: searchTerm });

    expect(result).toHaveLength(5);
  });

  it("filters by language when language filtering is requested", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const searchTerm = `chapterlanguage${uniqueId}`;

    const [enCourse, ptCourse] = await Promise.all([
      courseFixture({ isPublished: true, language: "en", organizationId: brandOrg.id }),
      courseFixture({ isPublished: true, language: "pt", organizationId: brandOrg.id }),
    ]);

    const [enChapter, ptChapter] = await Promise.all([
      chapterFixture({
        courseId: enCourse.id,
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString(searchTerm),
        organizationId: brandOrg.id,
        title: searchTerm,
      }),
      chapterFixture({
        courseId: ptCourse.id,
        isPublished: true,
        language: "pt",
        normalizedTitle: normalizeString(searchTerm),
        organizationId: brandOrg.id,
        title: searchTerm,
      }),
    ]);

    const enResult = await searchChapters({
      filterByLanguage: true,
      language: "en",
      query: searchTerm,
    });

    const ptResult = await searchChapters({
      filterByLanguage: true,
      language: "pt",
      query: searchTerm,
    });

    const enIds = enResult.map((chapter) => chapter.id);
    const ptIds = ptResult.map((chapter) => chapter.id);

    expect(enIds).toContain(enChapter.id);
    expect(enIds).not.toContain(ptChapter.id);
    expect(ptIds).not.toContain(enChapter.id);
    expect(ptIds).toContain(ptChapter.id);
  });

  it("returns only published chapters from published brand courses", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const searchTerm = `chaptervisibility${uniqueId}`;

    const [publishedChapter, draftCourseChapter, schoolCourseChapter, unpublishedChapter] =
      await Promise.all([
        chapterFixture({
          courseId: publishedCourse.id,
          isPublished: true,
          normalizedTitle: normalizeString(searchTerm),
          organizationId: brandOrg.id,
          title: searchTerm,
        }),
        chapterFixture({
          courseId: draftCourse.id,
          isPublished: true,
          normalizedTitle: normalizeString(`${searchTerm} draft`),
          organizationId: brandOrg.id,
          title: `${searchTerm} draft`,
        }),
        chapterFixture({
          courseId: schoolCourse.id,
          isPublished: true,
          normalizedTitle: normalizeString(`${searchTerm} school`),
          organizationId: schoolOrg.id,
          title: `${searchTerm} school`,
        }),
        chapterFixture({
          courseId: publishedCourse.id,
          isPublished: false,
          normalizedTitle: normalizeString(`${searchTerm} unpublished`),
          organizationId: brandOrg.id,
          title: `${searchTerm} unpublished`,
        }),
      ]);

    const result = await searchChapters({ language: "en", query: searchTerm });
    const ids = result.map((chapter) => chapter.id);

    expect(ids).toContain(publishedChapter.id);
    expect(ids).not.toContain(draftCourseChapter.id);
    expect(ids).not.toContain(schoolCourseChapter.id);
    expect(ids).not.toContain(unpublishedChapter.id);
  });
});
