import { randomUUID } from "node:crypto";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { normalizeString } from "@zoonk/utils/string";
import { describe, expect, it } from "vitest";
import { searchCatalog } from "./search-catalog";

function searchableChapter({
  homeCourseId,
  language = "en",
  title,
  ...attrs
}: NonNullable<Parameters<typeof libraryChapterFixture>[0]> & { title: string }) {
  return libraryChapterFixture({
    homeCourseId,
    language,
    normalizedTitle: normalizeString(title),
    title,
    ...attrs,
  });
}

describe(searchCatalog, () => {
  it("returns course and chapter results in the catalog search contract", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const searchTerm = `catalogcontract${uniqueId}`;

    const organization = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({
      description: `Course description ${uniqueId}`,
      imageUrl: `https://example.com/course-${uniqueId}.jpg`,
      isPublished: true,
      language: "en",
      normalizedTitle: normalizeString(searchTerm),
      organizationId: organization.id,
      // A language course carries its target, so results can show its flag.
      targetLanguage: "es",
      title: searchTerm,
    });

    const chapter = await searchableChapter({
      description: `Chapter description ${uniqueId}`,
      homeCourseId: course.id,
      title: searchTerm,
    });

    const result = await searchCatalog({ language: "en", query: searchTerm });

    expect(result).toStrictEqual({
      chapters: [
        {
          brandSlug: organization.slug,
          courseId: course.id,
          courseSlug: course.slug,
          courseTitle: course.title,
          description: chapter.description,
          id: chapter.id,
          language: chapter.language,
          slug: chapter.slug,
          title: chapter.title,
        },
      ],
      courses: [
        {
          brandSlug: organization.slug,
          description: course.description,
          id: course.id,
          imageUrl: course.imageUrl,
          language: course.language,
          slug: course.slug,
          targetLanguage: "es",
          title: course.title,
        },
      ],
    });
  });

  it("ranks exact chapter titles first, then partial titles, then descriptions", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const searchTerm = `catalogrank${uniqueId}`;
    const organization = await organizationFixture({ kind: "brand" });
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const description = await searchableChapter({
      description: `About ${searchTerm}`,
      homeCourseId: course.id,
      title: `Unrelated ${uniqueId}`,
    });

    const partial = await searchableChapter({
      homeCourseId: course.id,
      title: `${searchTerm} advanced`,
    });

    const exact = await searchableChapter({ homeCourseId: course.id, title: searchTerm });

    const result = await searchCatalog({ language: "en", query: searchTerm });

    expect(result.chapters.map((chapter) => chapter.id)).toStrictEqual([
      exact.id,
      partial.id,
      description.id,
    ]);
  });

  it("only finds public chapters whose home course the catalog lists", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const searchTerm = `catalogvisible${uniqueId}`;

    const [owner, brand, school] = await Promise.all([
      userFixture(),
      organizationFixture({ kind: "brand" }),
      organizationFixture({ kind: "school" }),
    ]);

    const [published, unpublished, undescribed, schoolCourse, privateCourse] = await Promise.all([
      courseFixture({ isPublished: true, organizationId: brand.id }),
      courseFixture({ isPublished: false, organizationId: brand.id }),
      // A shared course whose page details aren't written yet.
      courseFixture({ description: null, isPublished: true, organizationId: brand.id }),
      courseFixture({ isPublished: true, organizationId: school.id }),
      courseFixture({ userId: owner.id, visibility: "private" }),
    ]);

    const [visible] = await Promise.all([
      searchableChapter({ homeCourseId: published.id, title: searchTerm }),
      searchableChapter({
        homeCourseId: published.id,
        ownerId: owner.id,
        title: searchTerm,
        visibility: "private",
      }),
      searchableChapter({ homeCourseId: unpublished.id, title: searchTerm }),
      searchableChapter({ homeCourseId: undescribed.id, title: searchTerm }),
      searchableChapter({ homeCourseId: schoolCourse.id, title: searchTerm }),
      searchableChapter({ homeCourseId: privateCourse.id, title: searchTerm }),
      searchableChapter({ homeCourseId: null, title: searchTerm }),
    ]);

    const result = await searchCatalog({ language: "en", query: searchTerm });

    expect(result.chapters.map((chapter) => chapter.id)).toStrictEqual([visible.id]);
  });

  it("limits results to the requested language", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const searchTerm = `cataloglanguage${uniqueId}`;
    const organization = await organizationFixture({ kind: "brand" });

    const [englishCourse, portugueseCourse] = await Promise.all([
      courseFixture({
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString(searchTerm),
        organizationId: organization.id,
        title: searchTerm,
      }),
      courseFixture({
        isPublished: true,
        language: "pt",
        normalizedTitle: normalizeString(searchTerm),
        organizationId: organization.id,
        title: searchTerm,
      }),
    ]);

    const [englishChapter] = await Promise.all([
      searchableChapter({ homeCourseId: englishCourse.id, title: searchTerm }),
      searchableChapter({ homeCourseId: portugueseCourse.id, language: "pt", title: searchTerm }),
    ]);

    const result = await searchCatalog({ language: "en", query: searchTerm });

    expect(result.courses.map((course) => course.id)).toStrictEqual([englishCourse.id]);
    expect(result.chapters.map((chapter) => chapter.id)).toStrictEqual([englishChapter.id]);
  });
});
