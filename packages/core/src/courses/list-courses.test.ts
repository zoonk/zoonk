import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseCategoryFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { cacheTag } from "next/cache";
import { describe, expect, it } from "vitest";
import { COURSE_LIST_CACHE_TAG } from "../cache/tags";
import { LIST_COURSES_LIMIT, listCourses } from "./list-courses";

/**
 * A unique language isolates each catalog query from courses created by other
 * integration tests while still exercising the real language filter.
 */
function createTestLanguage() {
  return randomUUID().slice(0, 10);
}

describe(listCourses, () => {
  it("excludes unpublished courses and courses from non-brand organizations", async () => {
    const language = createTestLanguage();

    const [brandOrganization, schoolOrganization] = await Promise.all([
      organizationFixture({ kind: "brand" }),
      organizationFixture({ kind: "school" }),
    ]);

    const [publishedCourse, draftCourse, schoolCourse] = await Promise.all([
      courseFixture({ isPublished: true, language, organizationId: brandOrganization.id }),
      courseFixture({ isPublished: false, language, organizationId: brandOrganization.id }),
      courseFixture({ isPublished: true, language, organizationId: schoolOrganization.id }),
    ]);

    const result = await listCourses({ language, limit: 100 });
    const ids = result.map((course) => course.id);

    expect(ids).toContain(publishedCourse.id);
    expect(ids).not.toContain(draftCourse.id);
    expect(ids).not.toContain(schoolCourse.id);
    expect(cacheTag).toHaveBeenCalledWith(COURSE_LIST_CACHE_TAG);
  });

  it("filters courses by language", async () => {
    const [english, portuguese] = [createTestLanguage(), createTestLanguage()];
    const organization = await organizationFixture({ kind: "brand" });

    const [englishCourse, portugueseCourse] = await Promise.all([
      courseFixture({ isPublished: true, language: english, organizationId: organization.id }),
      courseFixture({ isPublished: true, language: portuguese, organizationId: organization.id }),
    ]);

    const [englishResult, portugueseResult] = await Promise.all([
      listCourses({ language: english, limit: 100 }),
      listCourses({ language: portuguese, limit: 100 }),
    ]);

    expect(englishResult.map((course) => course.id)).toContain(englishCourse.id);
    expect(englishResult.map((course) => course.id)).not.toContain(portugueseCourse.id);
    expect(portugueseResult.map((course) => course.id)).not.toContain(englishCourse.id);
    expect(portugueseResult.map((course) => course.id)).toContain(portugueseCourse.id);
  });

  it("filters courses by category", async () => {
    const language = createTestLanguage();
    const organization = await organizationFixture({ kind: "brand" });

    const [technologyCourse, scienceCourse] = await Promise.all([
      courseFixture({ isPublished: true, language, organizationId: organization.id }),
      courseFixture({ isPublished: true, language, organizationId: organization.id }),
    ]);

    await Promise.all([
      courseCategoryFixture({ category: "tech", courseId: technologyCourse.id }),
      courseCategoryFixture({ category: "science", courseId: scienceCourse.id }),
    ]);

    const result = await listCourses({ category: "tech", language, limit: 100 });
    const ids = result.map((course) => course.id);

    expect(ids).toContain(technologyCourse.id);
    expect(ids).not.toContain(scienceCourse.id);
  });

  it("returns the organization slug needed by catalog links", async () => {
    const language = createTestLanguage();
    const organization = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({
      isPublished: true,
      language,
      organizationId: organization.id,
    });

    const result = await listCourses({ language });
    const returnedCourse = result.find((item) => item.id === course.id);

    expect(returnedCourse?.organization).toMatchObject({ slug: organization.slug });
  });

  it("uses the default page size", async () => {
    const language = createTestLanguage();
    const organization = await organizationFixture({ kind: "brand" });

    await prisma.course.createMany({
      data: Array.from({ length: LIST_COURSES_LIMIT + 1 }, (_, index) => ({
        description: `Default limit course ${index}`,
        imageUrl: null,
        isPublished: true,
        language,
        normalizedTitle: `default limit course ${index}`,
        organizationId: organization.id,
        slug: `default-limit-${randomUUID()}-${index}`,
        title: `Default Limit Course ${index}`,
      })),
    });

    const result = await listCourses({ language });

    expect(result).toHaveLength(LIST_COURSES_LIMIT);
  });

  it("limits results to the requested page size", async () => {
    const language = createTestLanguage();
    const organization = await organizationFixture({ kind: "brand" });

    await prisma.course.createMany({
      data: Array.from({ length: 5 }, (_, index) => ({
        description: `Custom limit course ${index}`,
        imageUrl: null,
        isPublished: true,
        language,
        normalizedTitle: `custom limit course ${index}`,
        organizationId: organization.id,
        slug: `custom-limit-${randomUUID()}-${index}`,
        title: `Custom Limit Course ${index}`,
      })),
    });

    const result = await listCourses({ language, limit: 3 });

    expect(result).toHaveLength(3);
  });

  it("paginates without returning the cursor again", async () => {
    const language = createTestLanguage();
    const organization = await organizationFixture({ kind: "brand" });

    await prisma.course.createMany({
      data: Array.from({ length: 5 }, (_, index) => ({
        description: `Cursor course ${index}`,
        imageUrl: null,
        isPublished: true,
        language,
        normalizedTitle: `cursor course ${index}`,
        organizationId: organization.id,
        slug: `cursor-${randomUUID()}-${index}`,
        title: `Cursor Course ${index}`,
      })),
    });

    const firstPage = await listCourses({ language, limit: 3 });
    const cursor = firstPage.at(-1);

    expect(cursor).toBeDefined();

    const secondPage = await listCourses({ cursor: cursor?.id, language, limit: 3 });
    const firstPageIds = new Set(firstPage.map((course) => course.id));

    expect(firstPage).toHaveLength(3);
    expect(secondPage).toHaveLength(2);
    expect(secondPage.some((course) => firstPageIds.has(course.id))).toBe(false);
  });

  it("sorts courses by popularity", async () => {
    const language = createTestLanguage();
    const organization = await organizationFixture({ kind: "brand" });

    const [popularCourse, mediumCourse, unpopularCourse] = await Promise.all([
      courseFixture({
        isPublished: true,
        language,
        organizationId: organization.id,
        userCount: 100,
      }),
      courseFixture({
        isPublished: true,
        language,
        organizationId: organization.id,
        userCount: 50,
      }),
      courseFixture({
        isPublished: true,
        language,
        organizationId: organization.id,
        userCount: 10,
      }),
    ]);

    const result = await listCourses({ language });

    expect(result.map((course) => course.id)).toStrictEqual([
      popularCourse.id,
      mediumCourse.id,
      unpopularCourse.id,
    ]);
  });
});
