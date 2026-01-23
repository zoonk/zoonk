import { ErrorCode } from "@/lib/app-error";
import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { courseCategoryFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import { memberFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { addCategoryToCourse } from "./add-category-to-course";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    const result = await addCategoryToCourse({
      category: "tech",
      courseId: course.id,
      headers: new Headers(),
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("members", () => {
  test("returns Forbidden", async () => {
    const { organization, user } = await memberFixture({ role: "member" });

    const [headers, course] = await Promise.all([
      signInAs(user.email, user.password),
      courseFixture({ organizationId: organization.id }),
    ]);

    const result = await addCategoryToCourse({
      category: "tech",
      courseId: course.id,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("admins", () => {
  let organization: Awaited<ReturnType<typeof memberFixture>>["organization"];
  let headers: Headers;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    organization = fixture.organization;
    headers = await signInAs(fixture.user.email, fixture.user.password);
  });

  test("adds category to course successfully", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    const result = await addCategoryToCourse({
      category: "tech",
      courseId: course.id,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data?.category).toBe("tech");
    expect(result.data?.courseId).toBe(course.id);
  });

  test("adds multiple categories to same course", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    const [result1, result2] = await Promise.all([
      addCategoryToCourse({
        category: "tech",
        courseId: course.id,
        headers,
      }),
      addCategoryToCourse({
        category: "science",
        courseId: course.id,
        headers,
      }),
    ]);

    expect(result1.error).toBeNull();
    expect(result2.error).toBeNull();

    const categories = await prisma.courseCategory.findMany({
      where: { courseId: course.id },
    });

    expect(categories.length).toBe(2);
  });

  test("returns error when category already added", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    await courseCategoryFixture({
      category: "tech",
      courseId: course.id,
    });

    const result = await addCategoryToCourse({
      category: "tech",
      courseId: course.id,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.categoryAlreadyAdded);
    expect(result.data).toBeNull();
  });

  test("returns Course not found", async () => {
    const result = await addCategoryToCourse({
      category: "tech",
      courseId: 999_999,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.courseNotFound);
    expect(result.data).toBeNull();
  });

  test("returns Invalid category for unknown category", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    const result = await addCategoryToCourse({
      category: "invalid-category",
      courseId: course.id,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.invalidCategory);
    expect(result.data).toBeNull();
  });

  test("returns Forbidden for course in different organization", async () => {
    const otherOrg = await organizationFixture();
    const course = await courseFixture({ organizationId: otherOrg.id });

    const result = await addCategoryToCourse({
      category: "tech",
      courseId: course.id,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});
