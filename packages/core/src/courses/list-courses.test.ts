import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseCategoryFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  catalogCourseFixture,
  privateCourseFixture,
} from "@zoonk/testing/fixtures/library-courses";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { cacheTag } from "next/cache";
import { describe, expect, it } from "vitest";
import { COURSE_LIST_CACHE_TAG } from "../cache/tags";
import { LIST_COURSES_LIMIT, listCourses, listCoursesPage } from "./list-courses";

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

  it("lists a shared course only once its page details are written, and never a private one", async () => {
    const language = createTestLanguage();
    const organization = await organizationFixture({ kind: "brand" });

    const [listed] = await Promise.all([
      courseFixture({ isPublished: true, language, organizationId: organization.id }),
      courseFixture({
        description: null,
        isPublished: true,
        language,
        organizationId: organization.id,
      }),
      courseFixture({
        isPublished: true,
        language,
        organizationId: organization.id,
        visibility: "private",
      }),
    ]);

    const [list, page] = await Promise.all([
      listCourses({ language, limit: 100 }),
      listCoursesPage({ language, limit: 100 }),
    ]);

    expect(list.map((course) => course.id)).toStrictEqual([listed.id]);
    expect(page.courses.map((course) => course.id)).toStrictEqual([listed.id]);
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

  it("returns only what a course card shows, keeping internal course and organization fields out", async () => {
    const language = createTestLanguage();
    const organization = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({
      isPublished: true,
      language,
      organizationId: organization.id,
    });

    const [list, page] = await Promise.all([
      listCourses({ language }),
      listCoursesPage({ language }),
    ]);

    const cardKeys = [
      "categories",
      "description",
      "estimatedMinutes",
      "id",
      "imageUrl",
      "language",
      "lessonCount",
      "organization",
      "slug",
      "targetLanguage",
      "title",
    ];

    for (const listed of [list[0], page.courses[0]]) {
      expect(listed?.id).toBe(course.id);
      expect(Object.keys(listed ?? {}).toSorted()).toStrictEqual(cardKeys);

      expect(Object.keys(listed?.organization ?? {}).toSorted()).toStrictEqual([
        "id",
        "logo",
        "name",
        "slug",
      ]);
    }
  });

  it("carries only a course's first category, the subject its card shows", async () => {
    const language = createTestLanguage();
    const organization = await organizationFixture({ kind: "brand" });
    const listed = { isPublished: true, language, organizationId: organization.id };

    const [course, uncategorized] = await Promise.all([
      courseFixture(listed),
      courseFixture(listed),
    ]);

    await prisma.courseCategory.createMany({
      data: [
        { category: "tech", courseId: course.id, createdAt: new Date("2026-01-02T00:00:00Z") },
        { category: "science", courseId: course.id, createdAt: new Date("2026-01-01T00:00:00Z") },
      ],
    });

    const [list, page] = await Promise.all([
      listCourses({ language }),
      listCoursesPage({ language }),
    ]);

    for (const courses of [list, page.courses]) {
      const byId = new Map(courses.map((item) => [item.id, item.categories]));

      expect(byId.get(course.id)?.map((item) => item.category)).toStrictEqual(["science"]);
      expect(byId.get(uncategorized.id)).toStrictEqual([]);
    }
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

  it("counts each course's shared lessons and adds up their estimated minutes", async () => {
    const language = createTestLanguage();

    const [{ chapters, course, organization }, owner] = await Promise.all([
      catalogCourseFixture({ language, lessonCounts: [3, 2] }),
      userFixture(),
    ]);

    const [longLesson, emptyCourse] = await Promise.all([
      libraryLessonFixture({ estimatedMinutes: 12, language }),
      courseFixture({ isPublished: true, language, organizationId: organization.id }),
      privateCourseFixture({ language, lessonCounts: [2], ownerId: owner.id }),
    ]);

    await chapterLessonFixture({ chapterId: chapters[0]!.id, lessonId: longLesson.id });

    const [list, page] = await Promise.all([
      listCourses({ language, limit: 100 }),
      listCoursesPage({ language, limit: 100 }),
    ]);

    const expected = [
      { estimatedMinutes: 5 * 4 + 12, id: course.id, lessonCount: 6 },
      { estimatedMinutes: 0, id: emptyCourse.id, lessonCount: 0 },
    ];

    const totals = (courses: typeof list) =>
      courses
        .map(({ estimatedMinutes, id, lessonCount }) => ({ estimatedMinutes, id, lessonCount }))
        .toSorted((a, b) => b.lessonCount - a.lessonCount);

    expect(totals(list)).toStrictEqual(expected);
    expect(totals(page.courses)).toStrictEqual(expected);
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
