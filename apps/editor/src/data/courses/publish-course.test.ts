import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { toggleCoursePublished } from "./publish-course";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({
      isPublished: false,
      organizationId: organization.id,
    });

    const result = await toggleCoursePublished({
      courseId: course.id,
      headers: new Headers(),
      isPublished: true,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });
});

describe("members", () => {
  test("returns Forbidden", async () => {
    const { organization, user } = await memberFixture({ role: "member" });
    const headers = await signInAs(user.email, user.password);
    const course = await courseFixture({
      isPublished: false,
      organizationId: organization.id,
    });

    const result = await toggleCoursePublished({
      courseId: course.id,
      headers,
      isPublished: true,
    });

    expect(result.error?.message).toBe("Forbidden");
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

  test("returns Course not found", async () => {
    const result = await toggleCoursePublished({
      courseId: 999_999,
      headers,
      isPublished: true,
    });

    expect(result.error?.message).toBe("Course not found");
    expect(result.data).toBeNull();
  });

  test("publishes a draft course", async () => {
    const course = await courseFixture({
      isPublished: false,
      organizationId: organization.id,
    });

    const result = await toggleCoursePublished({
      courseId: course.id,
      headers,
      isPublished: true,
    });

    expect(result.error).toBeNull();
    expect(result.data?.isPublished).toBe(true);
  });

  test("unpublishes a published course", async () => {
    const course = await courseFixture({
      isPublished: true,
      organizationId: organization.id,
    });

    const result = await toggleCoursePublished({
      courseId: course.id,
      headers,
      isPublished: false,
    });

    expect(result.error).toBeNull();
    expect(result.data?.isPublished).toBe(false);
  });

  test("returns Forbidden for course in different organization", async () => {
    const otherOrg = await organizationFixture();

    const course = await courseFixture({
      isPublished: false,
      organizationId: otherOrg.id,
    });

    const result = await toggleCoursePublished({
      courseId: course.id,
      headers,
      isPublished: true,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();

    const unchangedCourse = await prisma.course.findUnique({
      where: { id: course.id },
    });

    expect(unchangedCourse?.isPublished).toBe(false);
  });
});
