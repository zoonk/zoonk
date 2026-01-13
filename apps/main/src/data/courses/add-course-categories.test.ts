import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { addCourseCategories } from "./add-course-categories";

describe("addCourseCategories", () => {
  let org: Awaited<ReturnType<typeof organizationFixture>>;

  beforeAll(async () => {
    org = await organizationFixture();
  });

  test("adds categories to course", async () => {
    const course = await courseFixture({ organizationId: org.id });
    const categories = ["Arts", "Business"];

    const result = await addCourseCategories({
      categories,
      courseId: course.id,
    });

    expect(result.error).toBeNull();

    const courseCategories = await prisma.courseCategory.findMany({
      where: { courseId: course.id },
    });

    expect(courseCategories).toHaveLength(2);
    expect(courseCategories.map((c) => c.category)).toEqual(
      expect.arrayContaining(categories),
    );
  });

  test("skips duplicates", async () => {
    const course = await courseFixture({ organizationId: org.id });

    await addCourseCategories({
      categories: ["Arts"],
      courseId: course.id,
    });

    const result = await addCourseCategories({
      categories: ["Arts", "Business"],
      courseId: course.id,
    });

    expect(result.error).toBeNull();

    const courseCategories = await prisma.courseCategory.findMany({
      where: { courseId: course.id },
    });

    expect(courseCategories).toHaveLength(2);
  });
});
