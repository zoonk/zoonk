import { prisma } from "@zoonk/db";
import { describe, expect, test } from "vitest";
import { signInAs } from "@/fixtures/auth";
import { courseFixture } from "@/fixtures/courses";
import { memberFixture, organizationFixture } from "@/fixtures/orgs";
import { deleteCourse } from "./delete-course";

describe("non-existent course", () => {
  test("returns Course not found", async () => {
    const result = await deleteCourse({
      courseId: 999_999,
      headers: new Headers(),
    });

    expect(result.error?.message).toBe("Course not found");
    expect(result.data).toBeNull();
  });
});

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
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

describe("members", () => {
  test("returns Forbidden", async () => {
    const { organization, user } = await memberFixture({ role: "member" });
    const headers = await signInAs(user.email, user.password);
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

describe("admins", () => {
  test("returns Forbidden", async () => {
    const { organization, user } = await memberFixture({ role: "admin" });
    const headers = await signInAs(user.email, user.password);
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

describe("owners", () => {
  test("deletes course successfully", async () => {
    const { organization, user } = await memberFixture({ role: "owner" });
    const headers = await signInAs(user.email, user.password);
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
    const { user } = await memberFixture({ role: "owner" });
    const org2 = await organizationFixture();
    const headers = await signInAs(user.email, user.password);
    const courseInOrg2 = await courseFixture({ organizationId: org2.id });

    const result = await deleteCourse({
      courseId: courseInOrg2.id,
      headers,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();

    const unchangedCourse = await prisma.course.findUnique({
      where: { id: courseInOrg2.id },
    });

    expect(unchangedCourse).not.toBeNull();
  });
});
