import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { normalizeString } from "@zoonk/utils/string";
import { beforeAll, describe, expect, test } from "vitest";
import { searchCourses } from "./search-courses";

describe(searchCourses, () => {
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
      courseFixture({
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString("Learn JavaScript Basics"),
        organizationId: brandOrg.id,
        title: "Learn JavaScript Basics",
      }),
      courseFixture({
        isPublished: false,
        language: "en",
        normalizedTitle: normalizeString("Draft JavaScript Course"),
        organizationId: brandOrg.id,
        title: "Draft JavaScript Course",
      }),
      courseFixture({
        isPublished: true,
        language: "en",
        normalizedTitle: normalizeString("School JavaScript Course"),
        organizationId: schoolOrg.id,
        title: "School JavaScript Course",
      }),
    ]);
  });

  test("returns empty array for empty query", async () => {
    const result = await searchCourses({ language: "en", query: "" });
    expect(result).toEqual([]);
  });

  test("returns empty array for whitespace-only query", async () => {
    const result = await searchCourses({ language: "en", query: "   " });
    expect(result).toEqual([]);
  });

  test("returns courses matching partial title", async () => {
    const result = await searchCourses({ language: "en", query: "JavaScript" });
    const ids = result.map((course) => course.id);

    expect(ids).toContain(publishedCourse.id);
  });

  test("search is case-insensitive", async () => {
    const uppercaseResult = await searchCourses({
      language: "en",
      query: "JAVASCRIPT",
    });
    const lowercaseResult = await searchCourses({
      language: "en",
      query: "javascript",
    });
    const mixedResult = await searchCourses({
      language: "en",
      query: "JaVaScRiPt",
    });

    const uppercaseIds = uppercaseResult.map((course) => course.id);
    const lowercaseIds = lowercaseResult.map((course) => course.id);
    const mixedIds = mixedResult.map((course) => course.id);

    expect(uppercaseIds).toContain(publishedCourse.id);
    expect(lowercaseIds).toContain(publishedCourse.id);
    expect(mixedIds).toContain(publishedCourse.id);
  });

  test("search handles accented characters", async () => {
    const accentedCourse = await courseFixture({
      isPublished: true,
      language: "pt",
      normalizedTitle: normalizeString("Programação em Python"),
      organizationId: brandOrg.id,
      title: "Programação em Python",
    });

    const withAccent = await searchCourses({
      language: "pt",
      query: "Programação",
    });

    const withoutAccent = await searchCourses({
      language: "pt",
      query: "Programacao",
    });

    const withAccentIds = withAccent.map((course) => course.id);
    const withoutAccentIds = withoutAccent.map((course) => course.id);

    expect(withAccentIds).toContain(accentedCourse.id);
    expect(withoutAccentIds).toContain(accentedCourse.id);
  });

  test("filters by required language parameter", async () => {
    const ptCourse = await courseFixture({
      isPublished: true,
      language: "pt",
      normalizedTitle: normalizeString("JavaScript em Português"),
      organizationId: brandOrg.id,
      title: "JavaScript em Português",
    });

    const enResult = await searchCourses({
      language: "en",
      query: "JavaScript",
    });

    const ptResult = await searchCourses({
      language: "pt",
      query: "JavaScript",
    });

    const enIds = enResult.map((course) => course.id);
    const ptIds = ptResult.map((course) => course.id);

    expect(enIds).toContain(publishedCourse.id);
    expect(enIds).not.toContain(ptCourse.id);
    expect(ptIds).toContain(ptCourse.id);
    expect(ptIds).not.toContain(publishedCourse.id);
  });

  test("returns only published courses from brand orgs", async () => {
    const result = await searchCourses({
      language: "en",
      query: "JavaScript",
    });

    const ids = result.map((course) => course.id);

    expect(ids).toContain(publishedCourse.id);
    expect(ids).not.toContain(draftCourse.id);
    expect(ids).not.toContain(schoolCourse.id);
  });

  test("limits results to default of 10", async () => {
    await prisma.course.createMany({
      data: Array.from({ length: 15 }, (_, i) => ({
        description: `Bulk course ${i} description`,
        imageUrl: "https://example.com/image.jpg",
        isPublished: true,
        language: "en",
        normalizedTitle: `bulk search limit test course ${i}`,
        organizationId: brandOrg.id,
        slug: `bulk-search-limit-test-${randomUUID()}-${i}`,
        title: `Bulk Search Limit Test Course ${i}`,
      })),
    });

    const result = await searchCourses({
      language: "en",
      query: "Bulk Search Limit Test",
    });

    expect(result).toHaveLength(10);
  });

  test("respects custom limit parameter", async () => {
    await prisma.course.createMany({
      data: Array.from({ length: 15 }, (_, i) => ({
        description: `Custom limit course ${i} description`,
        imageUrl: "https://example.com/image.jpg",
        isPublished: true,
        language: "en",
        normalizedTitle: `custom limit test course ${i}`,
        organizationId: brandOrg.id,
        slug: `custom-limit-test-${randomUUID()}-${i}`,
        title: `Custom Limit Test Course ${i}`,
      })),
    });

    const result = await searchCourses({
      language: "en",
      limit: 5,
      query: "Custom Limit Test",
    });

    expect(result).toHaveLength(5);
  });

  test("returns exact match first", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const searchTerm = `exactmatch${uniqueId}`;

    const [exactMatch, containsMatch1, containsMatch2] = await Promise.all([
      courseFixture({
        isPublished: true,
        language: "en",
        normalizedTitle: searchTerm,
        organizationId: brandOrg.id,
        title: searchTerm,
      }),
      courseFixture({
        isPublished: true,
        language: "en",
        normalizedTitle: `advanced ${searchTerm}`,
        organizationId: brandOrg.id,
        title: `Advanced ${searchTerm}`,
      }),
      courseFixture({
        isPublished: true,
        language: "en",
        normalizedTitle: `${searchTerm} fundamentals`,
        organizationId: brandOrg.id,
        title: `${searchTerm} Fundamentals`,
      }),
    ]);

    const result = await searchCourses({
      language: "en",
      query: searchTerm,
    });

    const ids = result.map((course) => course.id);

    expect(ids).toContain(exactMatch.id);
    expect(ids).toContain(containsMatch1.id);
    expect(ids).toContain(containsMatch2.id);
    expect(result[0]?.id).toBe(exactMatch.id);
  });

  test("respects offset parameter for pagination", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const searchTerm = `paginationtest${uniqueId}`;

    await prisma.course.createMany({
      data: Array.from({ length: 5 }, (_, i) => ({
        description: `Pagination test course ${i}`,
        imageUrl: "https://example.com/image.jpg",
        isPublished: true,
        language: "en",
        normalizedTitle: `${searchTerm} course ${i}`,
        organizationId: brandOrg.id,
        slug: `pagination-test-${uniqueId}-${i}`,
        title: `${searchTerm} Course ${i}`,
      })),
    });

    const firstPage = await searchCourses({
      language: "en",
      limit: 2,
      query: searchTerm,
    });

    const secondPage = await searchCourses({
      language: "en",
      limit: 2,
      offset: 2,
      query: searchTerm,
    });

    const thirdPage = await searchCourses({
      language: "en",
      limit: 2,
      offset: 4,
      query: searchTerm,
    });

    expect(firstPage).toHaveLength(2);
    expect(secondPage).toHaveLength(2);
    expect(thirdPage).toHaveLength(1);

    const firstPageIds = firstPage.map((course) => course.id);
    const secondPageIds = secondPage.map((course) => course.id);
    const thirdPageIds = thirdPage.map((course) => course.id);

    const allIds = [...firstPageIds, ...secondPageIds, ...thirdPageIds];
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(5);
  });

  test("returns empty array when offset exceeds results", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const searchTerm = `offsetexceed${uniqueId}`;

    await courseFixture({
      isPublished: true,
      language: "en",
      normalizedTitle: searchTerm,
      organizationId: brandOrg.id,
      title: searchTerm,
    });

    const result = await searchCourses({
      language: "en",
      offset: 100,
      query: searchTerm,
    });

    expect(result).toEqual([]);
  });

  test("clamps offset to prevent unbounded database queries", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const searchTerm = `clampoffset${uniqueId}`;

    await courseFixture({
      isPublished: true,
      language: "en",
      normalizedTitle: searchTerm,
      organizationId: brandOrg.id,
      title: searchTerm,
    });

    // A very large offset should be clamped to 100
    // and not cause the query to fetch millions of rows
    const result = await searchCourses({
      language: "en",
      offset: 1_000_000,
      query: searchTerm,
    });

    // With offset clamped to 100 and only 1 result, we get empty array
    expect(result).toEqual([]);
  });
});
