import { randomUUID } from "node:crypto";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { normalizeString } from "@zoonk/utils/string";
import { describe, expect, it } from "vitest";
import { searchCatalog } from "./search-catalog";

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
      title: searchTerm,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      description: `Chapter description ${uniqueId}`,
      imageUrl: `https://example.com/chapter-${uniqueId}.jpg`,
      isPublished: true,
      language: "en",
      normalizedTitle: normalizeString(searchTerm),
      organizationId: organization.id,
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
          imageUrl: chapter.imageUrl,
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
          title: course.title,
        },
      ],
    });
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

    const [englishChapter, portugueseChapter] = await Promise.all([
      chapterFixture({
        courseId: englishCourse.id,
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString(searchTerm),
        organizationId: organization.id,
        title: searchTerm,
      }),
      chapterFixture({
        courseId: portugueseCourse.id,
        isPublished: true,
        language: "pt",
        normalizedTitle: normalizeString(searchTerm),
        organizationId: organization.id,
        title: searchTerm,
      }),
    ]);

    const result = await searchCatalog({ language: "en", query: searchTerm });

    expect(result.courses.map((course) => course.id)).toStrictEqual([englishCourse.id]);
    expect(result.chapters.map((chapter) => chapter.id)).toStrictEqual([englishChapter.id]);
    expect(result.courses.map((course) => course.id)).not.toContain(portugueseCourse.id);
    expect(result.chapters.map((chapter) => chapter.id)).not.toContain(portugueseChapter.id);
  });
});
