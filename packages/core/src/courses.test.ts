import { prisma } from "@zoonk/db";
import { describe, expect, test } from "vitest";
import { organizationFixture } from "@/fixtures/organizations";
import { LIST_COURSES_LIMIT, listOrganizationCourses } from "./courses";

describe("listOrganizationCourses()", () => {
  test("returns list of courses for an org", async () => {
    const organization = await organizationFixture();

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

    const result = await listOrganizationCourses(organization.id);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(course.id);
  });

  test("filters courses by language", async () => {
    const organization = await organizationFixture();

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

    const result = await listOrganizationCourses(organization.id, {
      language: "en",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.language).toBe("en");
  });

  test("limits results to the specified amount", async () => {
    const organization = await organizationFixture();

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
    const result = await listOrganizationCourses(organization.id, {
      limit: customLimit,
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(customLimit);
  });

  test("uses default limit of 20", async () => {
    const organization = await organizationFixture();

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

    const result = await listOrganizationCourses(organization.id);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(LIST_COURSES_LIMIT);
  });

  test("returns courses ordered by createdAt descending", async () => {
    const organization = await organizationFixture();

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

    const result = await listOrganizationCourses(organization.id);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.id).toBe(newCourse.id);
    expect(result.data[1]?.id).toBe(oldCourse.id);
  });
});
