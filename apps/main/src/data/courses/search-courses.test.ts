import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { normalizeString } from "@zoonk/utils/string";
import { beforeAll, describe, expect, test } from "vitest";
import { searchCourses } from "./search-courses";

describe("searchCourses", () => {
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
    const ids = result.map((c) => c.id);

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

    const uppercaseIds = uppercaseResult.map((c) => c.id);
    const lowercaseIds = lowercaseResult.map((c) => c.id);
    const mixedIds = mixedResult.map((c) => c.id);

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

    const withAccentIds = withAccent.map((c) => c.id);
    const withoutAccentIds = withoutAccent.map((c) => c.id);

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

    const enIds = enResult.map((c) => c.id);
    const ptIds = ptResult.map((c) => c.id);

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

    const ids = result.map((c) => c.id);

    expect(ids).toContain(publishedCourse.id);
    expect(ids).not.toContain(draftCourse.id);
    expect(ids).not.toContain(schoolCourse.id);
  });

  test("sorts by latest created first", async () => {
    const oldCourse = await courseFixture({
      createdAt: new Date("2020-01-01"),
      isPublished: true,
      language: "en",
      normalizedTitle: normalizeString("Sorting Test Old Course"),
      organizationId: brandOrg.id,
      title: "Sorting Test Old Course",
    });

    const newCourse = await courseFixture({
      createdAt: new Date("2025-01-01"),
      isPublished: true,
      language: "en",
      normalizedTitle: normalizeString("Sorting Test New Course"),
      organizationId: brandOrg.id,
      title: "Sorting Test New Course",
    });

    const result = await searchCourses({
      language: "en",
      query: "Sorting Test",
    });

    const ids = result.map((c) => c.id);
    const oldIndex = ids.indexOf(oldCourse.id);
    const newIndex = ids.indexOf(newCourse.id);

    expect(newIndex).toBeLessThan(oldIndex);
  });

  test("limits results to 50", async () => {
    await prisma.course.createMany({
      data: Array.from({ length: 55 }, (_, i) => ({
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

    expect(result).toHaveLength(50);
  });
});
