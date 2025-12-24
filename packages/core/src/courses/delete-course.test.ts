import { prisma } from "@zoonk/db";
import { describe, expect, test } from "vitest";
import { signInAs } from "@/fixtures/auth";
import { courseFixture } from "@/fixtures/courses";
import { memberFixture, organizationFixture } from "@/fixtures/orgs";
import { deleteCourse } from "./delete-course";

describe("unauthenticated users", async () => {
  const organization = await organizationFixture();

  test("returns Forbidden", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    const result = await deleteCourse({
      courseId: course.id,
      headers: new Headers(),
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();

    const unchangedCourse = await prisma.course.findUnique({
      where: { id: course.id },
    });

    expect(unchangedCourse).not.toBeNull();
  });
});

describe("members", async () => {
  const { organization, user } = await memberFixture({ role: "member" });
  const headers = await signInAs(user.email, user.password);

  test("returns Forbidden", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    const result = await deleteCourse({
      courseId: course.id,
      headers,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();

    const unchangedCourse = await prisma.course.findUnique({
      where: { id: course.id },
    });

    expect(unchangedCourse).not.toBeNull();
  });
});

describe("admins", async () => {
  const { organization, user } = await memberFixture({ role: "admin" });
  const headers = await signInAs(user.email, user.password);

  test("returns Forbidden", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    const result = await deleteCourse({
      courseId: course.id,
      headers,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();

    const unchangedCourse = await prisma.course.findUnique({
      where: { id: course.id },
    });

    expect(unchangedCourse).not.toBeNull();
  });
});

describe("owners", async () => {
  const { organization, user } = await memberFixture({ role: "owner" });
  const headers = await signInAs(user.email, user.password);

  test("returns Course not found", async () => {
    const result = await deleteCourse({
      courseId: 999_999,
      headers,
    });

    expect(result.error?.message).toBe("Course not found");
    expect(result.data).toBeNull();
  });

  test("deletes course successfully", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    const result = await deleteCourse({
      courseId: course.id,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(course.id);

    const deletedCourse = await prisma.course.findUnique({
      where: { id: course.id },
    });

    expect(deletedCourse).toBeNull();
  });

  test("returns Forbidden for course in different organization", async () => {
    const otherOrg = await organizationFixture();

    const courseInOtherOrg = await courseFixture({
      organizationId: otherOrg.id,
    });

    const result = await deleteCourse({
      courseId: courseInOtherOrg.id,
      headers,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();

    const unchangedCourse = await prisma.course.findUnique({
      where: { id: courseInOtherOrg.id },
    });

    expect(unchangedCourse).not.toBeNull();
  });
});
