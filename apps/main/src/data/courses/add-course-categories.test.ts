import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { addCourseCategories } from "./add-course-categories";

describe("addCourseCategories", () => {
  let org: Awaited<ReturnType<typeof organizationFixture>>;
  let _course: Awaited<ReturnType<typeof courseFixture>>;

  beforeAll(async () => {
    org = await organizationFixture();
    _course = await courseFixture({ organizationId: org.id });
  });

  test("adds categories to a course", async () => {
    const newCourse = await courseFixture({ organizationId: org.id });

    await addCourseCategories({
      categories: ["tech", "science"],
      courseId: newCourse.id,
    });

    const categories = await prisma.courseCategory.findMany({
      orderBy: { category: "asc" },
      where: { courseId: newCourse.id },
    });

    expect(categories).toHaveLength(2);
    expect(categories[0]?.category).toBe("science");
    expect(categories[1]?.category).toBe("tech");
  });

  test("deduplicates categories", async () => {
    const newCourse = await courseFixture({ organizationId: org.id });

    await addCourseCategories({
      categories: ["tech", "tech", "science", "science"],
      courseId: newCourse.id,
    });

    const categories = await prisma.courseCategory.findMany({
      where: { courseId: newCourse.id },
    });

    expect(categories).toHaveLength(2);
  });

  test("skips duplicate categories on second call", async () => {
    const newCourse = await courseFixture({ organizationId: org.id });

    await addCourseCategories({
      categories: ["tech"],
      courseId: newCourse.id,
    });

    await addCourseCategories({
      categories: ["tech", "science"],
      courseId: newCourse.id,
    });

    const categories = await prisma.courseCategory.findMany({
      where: { courseId: newCourse.id },
    });

    expect(categories).toHaveLength(2);
  });

  test("handles empty categories array", async () => {
    const newCourse = await courseFixture({ organizationId: org.id });

    await addCourseCategories({
      categories: [],
      courseId: newCourse.id,
    });

    const categories = await prisma.courseCategory.findMany({
      where: { courseId: newCourse.id },
    });

    expect(categories).toHaveLength(0);
  });

  test("filters out empty string categories", async () => {
    const newCourse = await courseFixture({ organizationId: org.id });

    await addCourseCategories({
      categories: ["tech", "", "science", ""],
      courseId: newCourse.id,
    });

    const categories = await prisma.courseCategory.findMany({
      where: { courseId: newCourse.id },
    });

    expect(categories).toHaveLength(2);
  });
});
