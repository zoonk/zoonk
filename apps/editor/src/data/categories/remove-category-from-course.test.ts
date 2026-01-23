import { ErrorCode } from "@/lib/app-error";
import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { courseCategoryFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import { memberFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { removeCategoryFromCourse } from "./remove-category-from-course";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    await courseCategoryFixture({
      category: "tech",
      courseId: course.id,
    });

    const result = await removeCategoryFromCourse({
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

    await courseCategoryFixture({
      category: "tech",
      courseId: course.id,
    });

    const result = await removeCategoryFromCourse({
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

  test("removes category from course successfully", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    await courseCategoryFixture({
      category: "tech",
      courseId: course.id,
    });

    const result = await removeCategoryFromCourse({
      category: "tech",
      courseId: course.id,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data?.category).toBe("tech");
    expect(result.data?.courseId).toBe(course.id);

    const remaining = await prisma.courseCategory.findMany({
      where: { courseId: course.id },
    });

    expect(remaining.length).toBe(0);
  });

  test("removes only the specified category", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    await Promise.all([
      courseCategoryFixture({ category: "tech", courseId: course.id }),
      courseCategoryFixture({ category: "science", courseId: course.id }),
      courseCategoryFixture({ category: "math", courseId: course.id }),
    ]);

    const result = await removeCategoryFromCourse({
      category: "science",
      courseId: course.id,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data?.category).toBe("science");

    const remaining = await prisma.courseCategory.findMany({
      orderBy: { category: "asc" },
      where: { courseId: course.id },
    });

    expect(remaining.length).toBe(2);
    expect(remaining[0]?.category).toBe("math");
    expect(remaining[1]?.category).toBe("tech");
  });

  test("returns Category not in course", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    const result = await removeCategoryFromCourse({
      category: "tech",
      courseId: course.id,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.categoryNotInCourse);
    expect(result.data).toBeNull();
  });

  test("returns Forbidden for course in different organization", async () => {
    const otherOrg = await organizationFixture();
    const course = await courseFixture({ organizationId: otherOrg.id });

    await courseCategoryFixture({
      category: "tech",
      courseId: course.id,
    });

    const result = await removeCategoryFromCourse({
      category: "tech",
      courseId: course.id,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});
