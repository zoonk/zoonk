import { type Organization, prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { beforeAll, describe, expect, test } from "vitest";
import { addCourseCategories } from "./add-course-categories";

describe("addCourseCategories", () => {
  let aiOrg: Organization;
  let otherOrg: Organization;

  beforeAll(async () => {
    [aiOrg, otherOrg] = await Promise.all([
      prisma.organization.upsert({
        create: { kind: "brand", name: "AI", slug: AI_ORG_SLUG },
        update: {},
        where: { slug: AI_ORG_SLUG },
      }),
      organizationFixture(),
    ]);
  });

  test("adds categories to a course in the AI org", async () => {
    const newCourse = await courseFixture({ organizationId: aiOrg.id });

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

  test("does not add categories to a course outside the AI org", async () => {
    const newCourse = await courseFixture({ organizationId: otherOrg.id });

    await addCourseCategories({
      categories: ["tech", "science"],
      courseId: newCourse.id,
    });

    const categories = await prisma.courseCategory.findMany({
      where: { courseId: newCourse.id },
    });

    expect(categories).toHaveLength(0);
  });

  test("deduplicates categories", async () => {
    const newCourse = await courseFixture({ organizationId: aiOrg.id });

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
    const newCourse = await courseFixture({ organizationId: aiOrg.id });

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
    const newCourse = await courseFixture({ organizationId: aiOrg.id });

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
    const newCourse = await courseFixture({ organizationId: aiOrg.id });

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
