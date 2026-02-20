import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { listCourses } from "./list-courses";

describe(listCourses, () => {
  let brandOrg: Awaited<ReturnType<typeof organizationFixture>>;
  let privateOrg: Awaited<ReturnType<typeof organizationFixture>>;
  let draftCourse: Awaited<ReturnType<typeof courseFixture>>;
  let privateCourse: Awaited<ReturnType<typeof courseFixture>>;

  beforeAll(async () => {
    [brandOrg, privateOrg] = await Promise.all([
      organizationFixture({ kind: "brand" }),
      organizationFixture({ kind: "school" }),
    ]);

    [draftCourse, privateCourse] = await Promise.all([
      courseFixture({
        isPublished: false,
        language: "en",
        organizationId: brandOrg.id,
      }),
      courseFixture({
        isPublished: true,
        language: "en",
        organizationId: privateOrg.id,
      }),
    ]);
  });

  test("excludes draft courses and non-brand orgs", async () => {
    const result = await listCourses({ language: "en", limit: 100 });
    const ids = result.map((course) => course.id);

    expect(ids).not.toContain(draftCourse.id);
    expect(ids).not.toContain(privateCourse.id);
  });

  test("filters by language", async () => {
    const ptCourse = await courseFixture({
      isPublished: true,
      language: "pt",
      organizationId: brandOrg.id,
    });

    const enResult = await listCourses({ language: "en", limit: 100 });
    const ptResult = await listCourses({ language: "pt", limit: 100 });

    const enIds = enResult.map((course) => course.id);
    const ptIds = ptResult.map((course) => course.id);

    expect(enIds).not.toContain(ptCourse.id);
    expect(ptIds).toContain(ptCourse.id);
  });

  test("limits results to specified amount", async () => {
    await prisma.course.createMany({
      data: Array.from({ length: 5 }, (_, i) => ({
        description: `Course ${i} description`,
        imageUrl: "https://example.com/image.jpg",
        isPublished: true,
        language: "en",
        normalizedTitle: `test course ${i}`,
        organizationId: brandOrg.id,
        slug: `test-course-${randomUUID()}-${i}`,
        title: `Test Course ${i}`,
      })),
    });

    const result = await listCourses({ language: "en", limit: 3 });

    expect(result).toHaveLength(3);
  });

  test("paginates using cursor", async () => {
    const uniqueLang = randomUUID().slice(0, 10);

    // Create 5 courses with a unique language so we have a clean, isolated set
    await prisma.course.createMany({
      data: Array.from({ length: 5 }, (_, idx) => ({
        description: `Cursor test course ${idx}`,
        imageUrl: null,
        isPublished: true,
        language: uniqueLang,
        normalizedTitle: `cursor test ${idx}`,
        organizationId: brandOrg.id,
        slug: `cursor-test-${randomUUID()}-${idx}`,
        title: `Cursor Test ${idx}`,
      })),
    });

    // Fetch the first page (3 items)
    const firstPage = await listCourses({ language: uniqueLang, limit: 3 });
    expect(firstPage).toHaveLength(3);

    // Fetch the second page using cursor (last item's id)
    const lastItem = firstPage.at(-1)!;
    const secondPage = await listCourses({
      cursor: lastItem.id,
      language: uniqueLang,
      limit: 3,
    });

    // Should return the remaining 2 courses
    expect(secondPage).toHaveLength(2);

    // No overlap between pages
    const firstPageIds = new Set(firstPage.map((course) => course.id));
    const hasOverlap = secondPage.some((course) => firstPageIds.has(course.id));
    expect(hasOverlap).toBeFalsy();
  });

  test("sorts by popularity (higher userCount first)", async () => {
    const uniqueLang = randomUUID().slice(0, 10);

    // Create courses with explicit userCount values
    const [popularCourse, mediumCourse, unpopularCourse] = await Promise.all([
      courseFixture({
        isPublished: true,
        language: uniqueLang,
        organizationId: brandOrg.id,
        userCount: 100,
      }),
      courseFixture({
        isPublished: true,
        language: uniqueLang,
        organizationId: brandOrg.id,
        userCount: 50,
      }),
      courseFixture({
        isPublished: true,
        language: uniqueLang,
        organizationId: brandOrg.id,
        userCount: 10,
      }),
    ]);

    const result = await listCourses({ language: uniqueLang });

    const ids = result.map((course) => course.id);
    expect(ids.indexOf(popularCourse.id)).toBeLessThan(ids.indexOf(mediumCourse.id));
    expect(ids.indexOf(mediumCourse.id)).toBeLessThan(ids.indexOf(unpopularCourse.id));
  });
});
