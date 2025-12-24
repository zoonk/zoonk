import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { describe, expect, test } from "vitest";
import { signInAs } from "@/fixtures/auth";
import { memberFixture, organizationFixture } from "@/fixtures/organizations";
import { userFixture } from "@/fixtures/users";
import { searchCourses } from "./search-courses";

describe("brand org: unauthenticated users", () => {
  test("returns Forbidden for visibility all", async () => {
    const organization = await organizationFixture({ kind: "brand" });

    const result = await searchCourses({
      headers: new Headers(),
      orgSlug: organization.slug,
      title: "test",
      visibility: "all",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });

  test("returns Forbidden for visibility draft", async () => {
    const organization = await organizationFixture({ kind: "brand" });

    const result = await searchCourses({
      headers: new Headers(),
      orgSlug: organization.slug,
      title: "test",
      visibility: "draft",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });

  test("returns matching published courses for visibility published", async () => {
    const organization = await organizationFixture({ kind: "brand" });
    const author = await userFixture();

    const course = await prisma.course.create({
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
        description: "Draft published course",
        isPublished: false,
        language: "en",
        normalizedTitle: "published draft course",
        organizationId: organization.id,
        slug: `draft-published-course-${randomUUID()}`,
        title: "Published Draft Course",
      },
    });

    const result = await searchCourses({
      headers: new Headers(),
      orgSlug: organization.slug,
      title: "published",
      visibility: "published",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(course.id);
  });
});

describe("brand org: non-members", () => {
  test("returns Forbidden for visibility all", async () => {
    const organization = await organizationFixture({ kind: "brand" });
    const { user } = await memberFixture();
    const headers = await signInAs(user.email, user.password);

    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "test",
      visibility: "all",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });
});

describe("brand org: members", () => {
  test("returns Forbidden for visibility draft", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "member",
    });
    const headers = await signInAs(user.email, user.password);

    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "test",
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
        normalizedTitle: "test course",
        organizationId: organization.id,
        slug: `published-${randomUUID()}`,
        title: "Test Course",
      },
    });

    await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Draft course",
        isPublished: false,
        language: "en",
        normalizedTitle: "test course draft",
        organizationId: organization.id,
        slug: `draft-${randomUUID()}`,
        title: "Test Course Draft",
      },
    });

    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "test",
      visibility: "published",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(publishedCourse.id);
  });
});

describe("brand org: admins", () => {
  test("returns matching courses for visibility all", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "admin",
    });
    const headers = await signInAs(user.email, user.password);

    const matchingCourse = await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Computer Science course",
        imageUrl: "https://example.com/image.jpg",
        language: "en",
        normalizedTitle: "computer science fundamentals",
        organizationId: organization.id,
        slug: `computer-science-${randomUUID()}`,
        title: "Computer Science Fundamentals",
      },
    });

    await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Biology course",
        imageUrl: "https://example.com/image.jpg",
        language: "en",
        normalizedTitle: "biology basics",
        organizationId: organization.id,
        slug: `biology-${randomUUID()}`,
        title: "Biology Basics",
      },
    });

    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "Computer",
      visibility: "all",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(matchingCourse.id);
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
        normalizedTitle: "test course",
        organizationId: organization.id,
        slug: `published-${randomUUID()}`,
        title: "Test Course",
      },
    });

    const draftCourse = await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Draft course",
        isPublished: false,
        language: "en",
        normalizedTitle: "test course draft",
        organizationId: organization.id,
        slug: `draft-${randomUUID()}`,
        title: "Test Course Draft",
      },
    });

    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "test",
      visibility: "draft",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(draftCourse.id);
  });

  test("matches partial words", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "admin",
    });
    const headers = await signInAs(user.email, user.password);

    const course = await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Computer Science course",
        imageUrl: "https://example.com/image.jpg",
        language: "en",
        normalizedTitle: "ciencia da computacao",
        organizationId: organization.id,
        slug: `computer-science-${randomUUID()}`,
        title: "Ciência da Computação",
      },
    });

    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "comput",
      visibility: "all",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(course.id);
  });

  test("matches words without accents to titles with accents", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "admin",
    });
    const headers = await signInAs(user.email, user.password);

    const course = await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Computer Science course",
        imageUrl: "https://example.com/image.jpg",
        language: "pt",
        normalizedTitle: "ciencia da computacao",
        organizationId: organization.id,
        slug: `ciencia-computacao-${randomUUID()}`,
        title: "Ciência da Computação",
      },
    });

    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "ciencia da computacao",
      visibility: "all",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(course.id);
  });

  test("is case-insensitive", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "admin",
    });
    const headers = await signInAs(user.email, user.password);

    const course = await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Programming course",
        imageUrl: "https://example.com/image.jpg",
        language: "en",
        normalizedTitle: "introduction to programming",
        organizationId: organization.id,
        slug: `programming-${randomUUID()}`,
        title: "Introduction to Programming",
      },
    });

    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "PROGRAMMING",
      visibility: "all",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(course.id);
  });

  test("returns only courses from the specified organization", async () => {
    const { organization: org1, user } = await memberFixture({
      orgKind: "brand",
      role: "admin",
    });
    const org2 = await organizationFixture();
    const headers = await signInAs(user.email, user.password);

    const org1Course = await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Org 1 course",
        imageUrl: "https://example.com/image.jpg",
        language: "en",
        normalizedTitle: "mathematics",
        organizationId: org1.id,
        slug: `math-${randomUUID()}`,
        title: "Mathematics",
      },
    });

    await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Org 2 course",
        imageUrl: "https://example.com/image.jpg",
        language: "en",
        normalizedTitle: "mathematics advanced",
        organizationId: org2.id,
        slug: `math-${randomUUID()}`,
        title: "Mathematics Advanced",
      },
    });

    const result = await searchCourses({
      headers,
      orgSlug: org1.slug,
      title: "Mathematics",
      visibility: "all",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(org1Course.id);
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
        description: "Old programming course",
        imageUrl: "https://example.com/image.jpg",
        language: "en",
        normalizedTitle: "old programming course",
        organizationId: organization.id,
        slug: `old-programming-${randomUUID()}`,
        title: "Old Programming Course",
      },
    });

    const newCourse = await prisma.course.create({
      data: {
        authorId: Number(user.id),
        createdAt: new Date("2024-06-01"),
        description: "New programming course",
        imageUrl: "https://example.com/image.jpg",
        language: "en",
        normalizedTitle: "new programming course",
        organizationId: organization.id,
        slug: `new-programming-${randomUUID()}`,
        title: "New Programming Course",
      },
    });

    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "programming",
      visibility: "all",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.id).toBe(newCourse.id);
    expect(result.data[1]?.id).toBe(oldCourse.id);
  });

  test("returns empty array when no courses match", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "admin",
    });
    const headers = await signInAs(user.email, user.password);

    await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Biology course",
        imageUrl: "https://example.com/image.jpg",
        language: "en",
        normalizedTitle: "biology basics",
        organizationId: organization.id,
        slug: `biology-${randomUUID()}`,
        title: "Biology Basics",
      },
    });

    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "Physics",
      visibility: "all",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(0);
  });

  test("filters by language", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "admin",
    });
    const headers = await signInAs(user.email, user.password);

    const enCourse = await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Machine learning basics",
        imageUrl: "https://example.com/image.jpg",
        language: "en",
        normalizedTitle: "machine learning basics",
        organizationId: organization.id,
        slug: `programming-en-${randomUUID()}`,
        title: "Machine Learning Basics",
      },
    });

    await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Portuguese machine learning course",
        imageUrl: "https://example.com/image.jpg",
        language: "pt",
        normalizedTitle: "machine learning basics",
        organizationId: organization.id,
        slug: `machine-learning-pt-${randomUUID()}`,
        title: "Machine Learning Basics",
      },
    });

    const result = await searchCourses({
      headers,
      language: "en",
      orgSlug: organization.slug,
      title: "machine",
      visibility: "all",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(enCourse.id);
    expect(result.data[0]?.language).toBe("en");
  });

  test("returns all languages when language is not specified", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "admin",
    });
    const headers = await signInAs(user.email, user.password);

    await prisma.course.createMany({
      data: [
        {
          authorId: Number(user.id),
          description: "English programming course",
          imageUrl: "https://example.com/image.jpg",
          language: "en",
          normalizedTitle: "programming 101",
          organizationId: organization.id,
          slug: `prog-en-${randomUUID()}`,
          title: "Programming 101",
        },
        {
          authorId: Number(user.id),
          description: "Portuguese programming course",
          imageUrl: "https://example.com/image.jpg",
          language: "pt",
          normalizedTitle: "programming 101",
          organizationId: organization.id,
          slug: `prog-pt-${randomUUID()}`,
          title: "Programming 101",
        },
      ],
    });

    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "programming",
      visibility: "all",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);
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

    const result = await searchCourses({
      headers: new Headers(),
      orgSlug: organization.slug,
      title: "published",
      visibility: "published",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });
});
