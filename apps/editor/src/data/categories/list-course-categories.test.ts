import { courseCategoryFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, test } from "vitest";
import { listCourseCategories } from "./list-course-categories";

describe(listCourseCategories, () => {
  test("returns empty array when course has no categories", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    const result = await listCourseCategories({
      courseSlug: course.slug,
      language: course.language,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  test("returns all categories for a course", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    await Promise.all([
      courseCategoryFixture({ category: "tech", courseId: course.id }),
      courseCategoryFixture({ category: "science", courseId: course.id }),
      courseCategoryFixture({ category: "math", courseId: course.id }),
    ]);

    const result = await listCourseCategories({
      courseSlug: course.slug,
      language: course.language,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data?.length).toBe(3);
  });

  test("returns categories sorted alphabetically", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    await Promise.all([
      courseCategoryFixture({ category: "tech", courseId: course.id }),
      courseCategoryFixture({ category: "arts", courseId: course.id }),
      courseCategoryFixture({ category: "math", courseId: course.id }),
    ]);

    const result = await listCourseCategories({
      courseSlug: course.slug,
      language: course.language,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data?.[0]?.category).toBe("arts");
    expect(result.data?.[1]?.category).toBe("math");
    expect(result.data?.[2]?.category).toBe("tech");
  });

  test("returns only categories for the specified course", async () => {
    const organization = await organizationFixture();

    const [course1, course2] = await Promise.all([
      courseFixture({ organizationId: organization.id }),
      courseFixture({ organizationId: organization.id }),
    ]);

    await Promise.all([
      courseCategoryFixture({ category: "tech", courseId: course1.id }),
      courseCategoryFixture({ category: "science", courseId: course1.id }),
      courseCategoryFixture({ category: "arts", courseId: course2.id }),
    ]);

    const result = await listCourseCategories({
      courseSlug: course1.slug,
      language: course1.language,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data?.length).toBe(2);
    expect(result.data?.every((category) => category.courseId === course1.id)).toBeTruthy();
  });

  test("returns empty array for non-existent course", async () => {
    const organization = await organizationFixture();

    const result = await listCourseCategories({
      courseSlug: "non-existent-course",
      language: "en",
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });
});
