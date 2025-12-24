import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { describe, expect, test } from "vitest";
import { signInAs } from "@/fixtures/auth";
import { memberFixture, organizationFixture } from "@/fixtures/orgs";
import { userFixture } from "@/fixtures/users";
import { LIST_COURSES_LIMIT, listCourses } from "./list-courses";

describe("brand org: unauthenticated users", () => {
  test("returns Forbidden for visibility all", async () => {
    const organization = await organizationFixture({ kind: "brand" });

    const result = await listCourses({
      headers: new Headers(),
      orgSlug: organization.slug,
      visibility: "all",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });

  test("returns Forbidden for visibility draft", async () => {
    const organization = await organizationFixture({ kind: "brand" });

    const result = await listCourses({
      headers: new Headers(),
      orgSlug: organization.slug,
      visibility: "draft",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });

  test("returns published courses for visibility published", async () => {
    const organization = await organizationFixture({ kind: "brand" });
    const author = await userFixture();

    const publishedCourse = await prisma.course.create({
      data: {
        authorId: Number(author.id),
        description: "Published course",
        isPublished: true,
        language: "en",
        normalizedTitle: "published course",
        organizationId: organization.id,
        slug: `published-course-${randomUUID()}`,
        title: "Published Course",
      },
    });

    await prisma.course.create({
      data: {
        authorId: Number(author.id),
        description: "Draft course",
        isPublished: false,
        language: "en",
        normalizedTitle: "draft course",
        organizationId: organization.id,
        slug: `draft-course-${randomUUID()}`,
        title: "Draft Course",
      },
    });

    const result = await listCourses({
      headers: new Headers(),
      orgSlug: organization.slug,
      visibility: "published",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(publishedCourse.id);
  });
});

describe("brand org: non-members", () => {
  test("returns Forbidden for visibility all", async () => {
    const organization = await organizationFixture({ kind: "brand" });
    const { user } = await memberFixture();
    const headers = await signInAs(user.email, user.password);

    const result = await listCourses({
      headers,
      orgSlug: organization.slug,
      visibility: "all",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });

  test("returns Forbidden for visibility draft", async () => {
    const organization = await organizationFixture({ kind: "brand" });
    const { user } = await memberFixture();
    const headers = await signInAs(user.email, user.password);

    const result = await listCourses({
      headers,
      orgSlug: organization.slug,
      visibility: "draft",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });
});

describe("brand org: members", () => {
  test("returns Forbidden for visibility all", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "member",
    });

    const headers = await signInAs(user.email, user.password);

    await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Test description",
        imageUrl: "https://example.com/image.jpg",
        language: "en",
        normalizedTitle: "test course",
        organizationId: organization.id,
        slug: `test-course-${randomUUID()}`,
        title: "Test Course",
      },
    });

    const result = await listCourses({
      headers,
      orgSlug: organization.slug,
      visibility: "all",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });

  test("returns Forbidden for visibility draft", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "member",
    });

    const headers = await signInAs(user.email, user.password);

    await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Draft course",
        isPublished: false,
        language: "en",
        normalizedTitle: "draft course",
        organizationId: organization.id,
        slug: `draft-course-${randomUUID()}`,
        title: "Draft Course",
      },
    });

    const result = await listCourses({
      headers,
      orgSlug: organization.slug,
      visibility: "draft",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });

  test("returns only published courses for visibility published", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "member",
    });

    const headers = await signInAs(user.email, user.password);

    const publishedCourse = await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Published course",
        isPublished: true,
        language: "en",
        normalizedTitle: "published course",
        organizationId: organization.id,
        slug: `published-course-${randomUUID()}`,
        title: "Published Course",
      },
    });

    await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Draft course",
        isPublished: false,
        language: "en",
        normalizedTitle: "draft course",
        organizationId: organization.id,
        slug: `draft-course-${randomUUID()}`,
        title: "Draft Course",
      },
    });

    const result = await listCourses({
      headers,
      orgSlug: organization.slug,
      visibility: "published",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(publishedCourse.id);
  });
});

describe("brand org: admins", () => {
  test("returns all courses for visibility all", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "admin",
    });

    const headers = await signInAs(user.email, user.password);

    const course = await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Test description",
        imageUrl: "https://example.com/image.jpg",
        language: "en",
        normalizedTitle: "test course",
        organizationId: organization.id,
        slug: `test-course-${randomUUID()}`,
        title: "Test Course",
      },
    });

    const result = await listCourses({
      headers,
      orgSlug: organization.slug,
      visibility: "all",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(course.id);
  });

  test("returns both published and draft courses for visibility all", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "admin",
    });
    const headers = await signInAs(user.email, user.password);

    await prisma.course.createMany({
      data: [
        {
          authorId: Number(user.id),
          description: "Published course",
          isPublished: true,
          language: "en",
          normalizedTitle: "published course",
          organizationId: organization.id,
          slug: `published-course-${randomUUID()}`,
          title: "Published Course",
        },
        {
          authorId: Number(user.id),
          description: "Draft course",
          isPublished: false,
          language: "en",
          normalizedTitle: "draft course",
          organizationId: organization.id,
          slug: `draft-course-${randomUUID()}`,
          title: "Draft Course",
        },
      ],
    });

    const result = await listCourses({
      headers,
      orgSlug: organization.slug,
      visibility: "all",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);
  });

  test("returns only draft courses for visibility draft", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "admin",
    });
    const headers = await signInAs(user.email, user.password);

    await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Published course",
        isPublished: true,
        language: "en",
        normalizedTitle: "published course",
        organizationId: organization.id,
        slug: `published-course-${randomUUID()}`,
        title: "Published Course",
      },
    });

    const draftCourse = await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Draft course",
        isPublished: false,
        language: "en",
        normalizedTitle: "draft course",
        organizationId: organization.id,
        slug: `draft-course-${randomUUID()}`,
        title: "Draft Course",
      },
    });

    const result = await listCourses({
      headers,
      orgSlug: organization.slug,
      visibility: "draft",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(draftCourse.id);
  });

  test("filters by language", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "admin",
    });
    const headers = await signInAs(user.email, user.password);

    await prisma.course.createMany({
      data: [
        {
          authorId: Number(user.id),
          description: "English course",
          imageUrl: "https://example.com/image.jpg",
          language: "en",
          normalizedTitle: "english course",
          organizationId: organization.id,
          slug: `english-course-${randomUUID()}`,
          title: "English Course",
        },
        {
          authorId: Number(user.id),
          description: "Portuguese course",
          imageUrl: "https://example.com/image.jpg",
          language: "pt",
          normalizedTitle: "portuguese course",
          organizationId: organization.id,
          slug: `portuguese-course-${randomUUID()}`,
          title: "Portuguese Course",
        },
      ],
    });

    const result = await listCourses({
      headers,
      language: "en",
      orgSlug: organization.slug,
      visibility: "all",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.language).toBe("en");
  });

  test("limits results to specified amount", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "admin",
    });
    const headers = await signInAs(user.email, user.password);

    await prisma.course.createMany({
      data: Array.from({ length: 5 }, (_, i) => ({
        authorId: Number(user.id),
        description: `Course ${i} description`,
        imageUrl: "https://example.com/image.jpg",
        language: "en",
        normalizedTitle: `test course ${i}`,
        organizationId: organization.id,
        slug: `test-course-${randomUUID()}-${i}`,
        title: `Test Course ${i}`,
      })),
    });

    const customLimit = 3;
    const result = await listCourses({
      headers,
      limit: customLimit,
      orgSlug: organization.slug,
      visibility: "all",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(customLimit);
  });

  test("uses default limit of 20", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "admin",
    });
    const headers = await signInAs(user.email, user.password);

    await prisma.course.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        authorId: Number(user.id),
        description: `Course ${i} description`,
        imageUrl: "https://example.com/image.jpg",
        language: "en",
        normalizedTitle: `test course ${i}`,
        organizationId: organization.id,
        slug: `test-course-${randomUUID()}-${i}`,
        title: `Test Course ${i}`,
      })),
    });

    const result = await listCourses({
      headers,
      orgSlug: organization.slug,
      visibility: "all",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(LIST_COURSES_LIMIT);
  });

  test("orders results by createdAt descending", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "admin",
    });
    const headers = await signInAs(user.email, user.password);

    const oldCourse = await prisma.course.create({
      data: {
        authorId: Number(user.id),
        createdAt: new Date("2024-01-01"),
        description: "Old course",
        imageUrl: "https://example.com/image.jpg",
        language: "en",
        normalizedTitle: "old course",
        organizationId: organization.id,
        slug: `old-course-${randomUUID()}`,
        title: "Old Course",
      },
    });

    const newCourse = await prisma.course.create({
      data: {
        authorId: Number(user.id),
        createdAt: new Date("2024-06-01"),
        description: "New course",
        imageUrl: "https://example.com/image.jpg",
        language: "en",
        normalizedTitle: "new course",
        organizationId: organization.id,
        slug: `new-course-${randomUUID()}`,
        title: "New Course",
      },
    });

    const result = await listCourses({
      headers,
      orgSlug: organization.slug,
      visibility: "all",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.id).toBe(newCourse.id);
    expect(result.data[1]?.id).toBe(oldCourse.id);
  });

  test("does not include organization data in results", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "admin",
    });
    const headers = await signInAs(user.email, user.password);

    await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Test course",
        language: "en",
        normalizedTitle: "test course",
        organizationId: organization.id,
        slug: `test-course-${randomUUID()}`,
        title: "Test Course",
      },
    });

    const result = await listCourses({
      headers,
      orgSlug: organization.slug,
      visibility: "all",
    });

    expect(result.error).toBeNull();
    expect(result.data[0]).not.toHaveProperty("organization");
  });
});

describe("school org: unauthenticated users", () => {
  test("returns Forbidden for visibility published", async () => {
    const organization = await organizationFixture({ kind: "school" });
    const author = await userFixture();

    await prisma.course.create({
      data: {
        authorId: Number(author.id),
        description: "Published course",
        isPublished: true,
        language: "en",
        normalizedTitle: "published course",
        organizationId: organization.id,
        slug: `published-course-${randomUUID()}`,
        title: "Published Course",
      },
    });

    const result = await listCourses({
      headers: new Headers(),
      orgSlug: organization.slug,
      visibility: "published",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });
});

describe("school org: members", () => {
  test("returns published courses for visibility published", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "school",
      role: "member",
    });
    const headers = await signInAs(user.email, user.password);

    const course = await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Published course",
        isPublished: true,
        language: "en",
        normalizedTitle: "published course",
        organizationId: organization.id,
        slug: `published-course-${randomUUID()}`,
        title: "Published Course",
      },
    });

    const result = await listCourses({
      headers,
      orgSlug: organization.slug,
      visibility: "published",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(course.id);
  });
});
