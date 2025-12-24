import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { describe, expect, test } from "vitest";
import { signInAs } from "@/fixtures/auth";
import { memberFixture, organizationFixture } from "@/fixtures/organizations";
import { userFixture } from "@/fixtures/users";
import { toggleCoursePublished } from "./courses";

describe("toggleCoursePublished()", () => {
  describe("non-existent course", () => {
    test("returns Course not found", async () => {
      const result = await toggleCoursePublished({
        courseId: 999_999,
        headers: new Headers(),
        isPublished: true,
      });

      expect(result.error?.message).toBe("Course not found");
      expect(result.data).toBeNull();
    });
  });

  describe("unauthenticated users", () => {
    test("returns Forbidden", async () => {
      const organization = await organizationFixture();
      const author = await userFixture();

      const course = await prisma.course.create({
        data: {
          authorId: Number(author.id),
          description: "Test description",
          language: "en",
          normalizedTitle: "test course",
          organizationId: organization.id,
          slug: `test-course-${randomUUID()}`,
          title: "Test Course",
        },
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

      const course = await prisma.course.create({
        data: {
          authorId: Number(user.id),
          description: "Test description",
          language: "en",
          normalizedTitle: "test course",
          organizationId: organization.id,
          slug: `test-course-${randomUUID()}`,
          title: "Test Course",
        },
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
    test("publishes a draft course", async () => {
      const { organization, user } = await memberFixture({ role: "admin" });
      const headers = await signInAs(user.email, user.password);

      const course = await prisma.course.create({
        data: {
          authorId: Number(user.id),
          description: "Test description",
          isPublished: false,
          language: "en",
          normalizedTitle: "test course",
          organizationId: organization.id,
          slug: `test-course-${randomUUID()}`,
          title: "Test Course",
        },
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
      const { organization, user } = await memberFixture({ role: "admin" });
      const headers = await signInAs(user.email, user.password);

      const course = await prisma.course.create({
        data: {
          authorId: Number(user.id),
          description: "Test description",
          isPublished: true,
          language: "en",
          normalizedTitle: "test course",
          organizationId: organization.id,
          slug: `test-course-${randomUUID()}`,
          title: "Test Course",
        },
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
      const { user } = await memberFixture({ role: "admin" });
      const org2 = await organizationFixture();
      const otherUser = await userFixture();
      const headers = await signInAs(user.email, user.password);

      const courseInOrg2 = await prisma.course.create({
        data: {
          authorId: Number(otherUser.id),
          description: "Course in different org",
          isPublished: false,
          language: "en",
          normalizedTitle: "test course in org2",
          organizationId: org2.id,
          slug: `test-course-org2-${randomUUID()}`,
          title: "Test Course in Org2",
        },
      });

      const result = await toggleCoursePublished({
        courseId: courseInOrg2.id,
        headers,
        isPublished: true,
      });

      expect(result.error?.message).toBe("Forbidden");
      expect(result.data).toBeNull();

      const unchangedCourse = await prisma.course.findUnique({
        where: { id: courseInOrg2.id },
      });
      expect(unchangedCourse?.isPublished).toBe(false);
    });
  });

  describe("owners", () => {
    test("toggles course published status successfully", async () => {
      const { organization, user } = await memberFixture({ role: "owner" });
      const headers = await signInAs(user.email, user.password);

      const course = await prisma.course.create({
        data: {
          authorId: Number(user.id),
          description: "Test description",
          isPublished: false,
          language: "en",
          normalizedTitle: "test course",
          organizationId: organization.id,
          slug: `test-course-${randomUUID()}`,
          title: "Test Course",
        },
      });

      const result = await toggleCoursePublished({
        courseId: course.id,
        headers,
        isPublished: true,
      });

      expect(result.error).toBeNull();
      expect(result.data?.isPublished).toBe(true);
    });
  });
});
