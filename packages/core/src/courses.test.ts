import { prisma } from "@zoonk/db";
import { PERMISSION_ERROR_CODE } from "@zoonk/utils/error";
import { describe, expect, test } from "vitest";
import { signInAs } from "@/fixtures/auth";
import { courseFixture } from "@/fixtures/courses";
import { memberFixture } from "@/fixtures/organizations";
import { LIST_COURSES_LIMIT, listOrganizationCourses } from "./courses";

describe("listOrganizationCourses()", () => {
  test("returns courses for users with admin role", async () => {
    const { organization, user } = await memberFixture({ role: "admin" });

    const course = await prisma.course.create({
      data: {
        description: "Test description",
        imageUrl: "https://example.com/image.jpg",
        language: "en",
        organizationId: organization.id,
        slug: `test-course-${Date.now()}`,
        title: "Test Course",
      },
    });

    const headers = await signInAs(user.email, user.password);
    const result = await listOrganizationCourses(organization.id, { headers });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(course.id);
  });

  test("returns courses for users with owner role", async () => {
    const { organization, user } = await memberFixture({ role: "owner" });

    const course = await prisma.course.create({
      data: {
        description: "Test description",
        imageUrl: "https://example.com/image.jpg",
        language: "en",
        organizationId: organization.id,
        slug: `test-course-${Date.now()}`,
        title: "Test Course",
      },
    });

    const headers = await signInAs(user.email, user.password);
    const result = await listOrganizationCourses(organization.id, { headers });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(course.id);
  });

  test("returns empty array for users with member role", async () => {
    const { organization, user } = await memberFixture({ role: "member" });

    await prisma.course.create({
      data: {
        description: "Test description",
        imageUrl: "https://example.com/image.jpg",
        language: "en",
        organizationId: organization.id,
        slug: `test-course-${Date.now()}`,
        title: "Test Course",
      },
    });

    const headers = await signInAs(user.email, user.password);
    const result = await listOrganizationCourses(organization.id, { headers });

    expect(result.data).toEqual([]);
    expect(result.error?.cause).toBe(PERMISSION_ERROR_CODE);
  });

  test("returns empty array for unauthenticated users", async () => {
    const { organization } = await courseFixture();

    const result = await listOrganizationCourses(organization.id, {
      headers: new Headers(),
    });

    expect(result.data).toEqual([]);
    expect(result.error?.cause).toBe(PERMISSION_ERROR_CODE);
  });

  test("filters courses by language", async () => {
    const { organization, user } = await memberFixture({ role: "admin" });

    await prisma.course.createMany({
      data: [
        {
          description: "English course",
          imageUrl: "https://example.com/image.jpg",
          language: "en",
          organizationId: organization.id,
          slug: `english-course-${Date.now()}`,
          title: "English Course",
        },
        {
          description: "Portuguese course",
          imageUrl: "https://example.com/image.jpg",
          language: "pt",
          organizationId: organization.id,
          slug: `portuguese-course-${Date.now()}`,
          title: "Portuguese Course",
        },
      ],
    });

    const headers = await signInAs(user.email, user.password);
    const result = await listOrganizationCourses(organization.id, {
      headers,
      language: "en",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.language).toBe("en");
  });

  test("limits results to the specified amount", async () => {
    const { organization, user } = await memberFixture({ role: "admin" });

    await prisma.course.createMany({
      data: Array.from({ length: 5 }, (_, i) => ({
        description: `Course ${i} description`,
        imageUrl: "https://example.com/image.jpg",
        language: "en",
        organizationId: organization.id,
        slug: `test-course-${Date.now()}-${i}`,
        title: `Test Course ${i}`,
      })),
    });

    const customLimit = 3;
    const headers = await signInAs(user.email, user.password);
    const result = await listOrganizationCourses(organization.id, {
      headers,
      limit: customLimit,
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(customLimit);
  });

  test("uses default limit of 20", async () => {
    const { organization, user } = await memberFixture({ role: "admin" });

    await prisma.course.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        description: `Course ${i} description`,
        imageUrl: "https://example.com/image.jpg",
        language: "en",
        organizationId: organization.id,
        slug: `test-course-${Date.now()}-${i}`,
        title: `Test Course ${i}`,
      })),
    });

    const headers = await signInAs(user.email, user.password);
    const result = await listOrganizationCourses(organization.id, { headers });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(LIST_COURSES_LIMIT);
  });

  test("returns courses ordered by createdAt descending", async () => {
    const { organization, user } = await memberFixture({ role: "admin" });

    const oldCourse = await prisma.course.create({
      data: {
        createdAt: new Date("2024-01-01"),
        description: "Old course",
        imageUrl: "https://example.com/image.jpg",
        language: "en",
        organizationId: organization.id,
        slug: `old-course-${Date.now()}`,
        title: "Old Course",
      },
    });

    const newCourse = await prisma.course.create({
      data: {
        createdAt: new Date("2024-06-01"),
        description: "New course",
        imageUrl: "https://example.com/image.jpg",
        language: "en",
        organizationId: organization.id,
        slug: `new-course-${Date.now()}`,
        title: "New Course",
      },
    });

    const headers = await signInAs(user.email, user.password);
    const result = await listOrganizationCourses(organization.id, { headers });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.id).toBe(newCourse.id);
    expect(result.data[1]?.id).toBe(oldCourse.id);
  });
});
