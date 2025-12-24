import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { describe, expect, test } from "vitest";
import { signInAs } from "@/fixtures/auth";
import { memberFixture, organizationFixture } from "@/fixtures/organizations";
import { userFixture } from "@/fixtures/users";
import {
  courseSlugExists,
  createCourse,
  deleteCourse,
  searchCourses,
  toggleCoursePublished,
  updateCourse,
} from "./courses";

describe("courseSlugExists()", () => {
  test("returns true when slug exists for same language and org", async () => {
    const organization = await organizationFixture();
    const author = await userFixture();
    const slug = `test-course-${randomUUID()}`;

    await prisma.course.create({
      data: {
        authorId: Number(author.id),
        description: "Test description",
        language: "en",
        normalizedTitle: "test course",
        organizationId: organization.id,
        slug,
        title: "Test Course",
      },
    });

    const exists = await courseSlugExists({
      language: "en",
      orgSlug: organization.slug,
      slug,
    });

    expect(exists).toBe(true);
  });

  test("returns false when slug does not exist", async () => {
    const organization = await organizationFixture();

    const exists = await courseSlugExists({
      language: "en",
      orgSlug: organization.slug,
      slug: "non-existent-slug",
    });

    expect(exists).toBe(false);
  });

  test("returns false when slug exists but language differs", async () => {
    const organization = await organizationFixture();
    const author = await userFixture();
    const slug = `test-course-${randomUUID()}`;

    await prisma.course.create({
      data: {
        authorId: Number(author.id),
        description: "Test description",
        language: "en",
        normalizedTitle: "test course",
        organizationId: organization.id,
        slug,
        title: "Test Course",
      },
    });

    const exists = await courseSlugExists({
      language: "pt",
      orgSlug: organization.slug,
      slug,
    });

    expect(exists).toBe(false);
  });

  test("returns false when slug exists but organization differs", async () => {
    const org1 = await organizationFixture();
    const org2 = await organizationFixture();
    const author = await userFixture();
    const slug = `test-course-${randomUUID()}`;

    await prisma.course.create({
      data: {
        authorId: Number(author.id),
        description: "Test description",
        language: "en",
        normalizedTitle: "test course",
        organizationId: org1.id,
        slug,
        title: "Test Course",
      },
    });

    const exists = await courseSlugExists({
      language: "en",
      orgSlug: org2.slug,
      slug,
    });

    expect(exists).toBe(false);
  });
});

describe("searchCourses()", () => {
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
});

describe("createCourse()", () => {
  describe("unauthenticated users", () => {
    test("returns Unauthorized", async () => {
      const organization = await organizationFixture();

      const result = await createCourse({
        description: "Test description",
        headers: new Headers(),
        language: "en",
        orgSlug: organization.slug,
        slug: "test-course",
        title: "Test Course",
      });

      expect(result.error?.message).toBe("Unauthorized");
      expect(result.data).toBeNull();
    });
  });

  describe("non-existent organization", () => {
    test("returns Organization not found", async () => {
      const { user } = await memberFixture({ role: "admin" });
      const headers = await signInAs(user.email, user.password);

      const result = await createCourse({
        description: "Test description",
        headers,
        language: "en",
        orgSlug: "non-existent-org",
        slug: "test-course",
        title: "Test Course",
      });

      expect(result.error?.message).toBe("Organization not found");
      expect(result.data).toBeNull();
    });
  });

  describe("members", () => {
    test("returns Forbidden", async () => {
      const { organization, user } = await memberFixture({ role: "member" });
      const headers = await signInAs(user.email, user.password);

      const result = await createCourse({
        description: "Test description",
        headers,
        language: "en",
        orgSlug: organization.slug,
        slug: "test-course",
        title: "Test Course",
      });

      expect(result.error?.message).toBe("Forbidden");
      expect(result.data).toBeNull();
    });
  });

  describe("admins", () => {
    test("creates course successfully", async () => {
      const { organization, user } = await memberFixture({ role: "admin" });
      const headers = await signInAs(user.email, user.password);
      const slug = `test-course-${randomUUID()}`;

      const result = await createCourse({
        description: "Test description",
        headers,
        language: "en",
        orgSlug: organization.slug,
        slug,
        title: "Test Course",
      });

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data?.title).toBe("Test Course");
      expect(result.data?.description).toBe("Test description");
      expect(result.data?.language).toBe("en");
      expect(result.data?.organizationId).toBe(organization.id);
      expect(result.data?.authorId).toBe(Number(user.id));
    });

    test("normalizes slug", async () => {
      const { organization, user } = await memberFixture({ role: "admin" });
      const headers = await signInAs(user.email, user.password);

      const result = await createCourse({
        description: "Test description",
        headers,
        language: "en",
        orgSlug: organization.slug,
        slug: "My Test Course!",
        title: "My Test Course",
      });

      expect(result.error).toBeNull();
      expect(result.data?.slug).toBe("my-test-course");
    });

    test("normalizes title for search", async () => {
      const { organization, user } = await memberFixture({ role: "admin" });
      const headers = await signInAs(user.email, user.password);
      const slug = `test-course-${randomUUID()}`;

      const result = await createCourse({
        description: "Test description",
        headers,
        language: "pt",
        orgSlug: organization.slug,
        slug,
        title: "Ciência da Computação",
      });

      expect(result.error).toBeNull();
      expect(result.data?.normalizedTitle).toBe("ciencia da computacao");
    });
  });

  describe("owners", () => {
    test("creates course successfully", async () => {
      const { organization, user } = await memberFixture({ role: "owner" });
      const headers = await signInAs(user.email, user.password);
      const slug = `test-course-${randomUUID()}`;

      const result = await createCourse({
        description: "Owner's course",
        headers,
        language: "pt",
        orgSlug: organization.slug,
        slug,
        title: "Owner Course",
      });

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data?.title).toBe("Owner Course");
    });
  });

  describe("duplicate slug", () => {
    test("returns error when slug already exists for same language and org", async () => {
      const { organization, user } = await memberFixture({ role: "admin" });
      const headers = await signInAs(user.email, user.password);
      const slug = `test-course-${randomUUID()}`;

      await createCourse({
        description: "First course",
        headers,
        language: "en",
        orgSlug: organization.slug,
        slug,
        title: "First Course",
      });

      const result = await createCourse({
        description: "Duplicate course",
        headers,
        language: "en",
        orgSlug: organization.slug,
        slug,
        title: "Duplicate Course",
      });

      expect(result.error).not.toBeNull();
    });

    test("allows same slug for different language", async () => {
      const { organization, user } = await memberFixture({ role: "admin" });
      const headers = await signInAs(user.email, user.password);
      const slug = `test-course-${randomUUID()}`;

      await createCourse({
        description: "English course",
        headers,
        language: "en",
        orgSlug: organization.slug,
        slug,
        title: "English Course",
      });

      const result = await createCourse({
        description: "Portuguese course",
        headers,
        language: "pt",
        orgSlug: organization.slug,
        slug,
        title: "Portuguese Course",
      });

      expect(result.error).toBeNull();
      expect(result.data?.language).toBe("pt");
    });
  });
});

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

describe("deleteCourse()", () => {
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

    test("returns Forbidden for course in different organization", async () => {
      const { user } = await memberFixture({ role: "admin" });
      const org2 = await organizationFixture();
      const otherUser = await userFixture();
      const headers = await signInAs(user.email, user.password);

      const courseInOrg2 = await prisma.course.create({
        data: {
          authorId: Number(otherUser.id),
          description: "Course in different org",
          language: "en",
          normalizedTitle: "test course in org2",
          organizationId: org2.id,
          slug: `test-course-org2-${randomUUID()}`,
          title: "Test Course in Org2",
        },
      });

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

  describe("owners", () => {
    test("deletes course successfully", async () => {
      const { organization, user } = await memberFixture({ role: "owner" });
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
  });
});

describe("updateCourse()", () => {
  describe("non-existent course", () => {
    test("returns Course not found", async () => {
      const result = await updateCourse({
        courseId: 999_999,
        headers: new Headers(),
        title: "Updated Title",
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

      const result = await updateCourse({
        courseId: course.id,
        headers: new Headers(),
        title: "Updated Title",
      });

      expect(result.error?.message).toBe("Forbidden");
      expect(result.data).toBeNull();

      const unchangedCourse = await prisma.course.findUnique({
        where: { id: course.id },
      });
      expect(unchangedCourse?.title).toBe("Test Course");
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

      const result = await updateCourse({
        courseId: course.id,
        headers,
        title: "Updated Title",
      });

      expect(result.error?.message).toBe("Forbidden");
      expect(result.data).toBeNull();

      const unchangedCourse = await prisma.course.findUnique({
        where: { id: course.id },
      });
      expect(unchangedCourse?.title).toBe("Test Course");
    });
  });

  describe("admins", () => {
    test("updates title successfully", async () => {
      const { organization, user } = await memberFixture({ role: "admin" });
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

      const result = await updateCourse({
        courseId: course.id,
        headers,
        title: "Updated Title",
      });

      expect(result.error).toBeNull();
      expect(result.data?.title).toBe("Updated Title");
      expect(result.data?.normalizedTitle).toBe("updated title");
    });

    test("returns course unchanged when no fields provided", async () => {
      const { organization, user } = await memberFixture({ role: "admin" });
      const headers = await signInAs(user.email, user.password);

      const course = await prisma.course.create({
        data: {
          authorId: Number(user.id),
          description: "Original description",
          language: "en",
          normalizedTitle: "test course",
          organizationId: organization.id,
          slug: `test-course-${randomUUID()}`,
          title: "Test Course",
        },
      });

      const result = await updateCourse({
        courseId: course.id,
        headers,
      });

      expect(result.error).toBeNull();
      expect(result.data?.title).toBe("Test Course");
      expect(result.data?.description).toBe("Original description");
    });

    test("updates description successfully", async () => {
      const { organization, user } = await memberFixture({ role: "admin" });
      const headers = await signInAs(user.email, user.password);

      const course = await prisma.course.create({
        data: {
          authorId: Number(user.id),
          description: "Original description",
          language: "en",
          normalizedTitle: "test course",
          organizationId: organization.id,
          slug: `test-course-${randomUUID()}`,
          title: "Test Course",
        },
      });

      const result = await updateCourse({
        courseId: course.id,
        description: "Updated description",
        headers,
      });

      expect(result.error).toBeNull();
      expect(result.data?.description).toBe("Updated description");
      expect(result.data?.title).toBe("Test Course");
    });

    test("updates slug and normalizes it", async () => {
      const { organization, user } = await memberFixture({ role: "admin" });
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

      const result = await updateCourse({
        courseId: course.id,
        headers,
        slug: "My New Slug!",
      });

      expect(result.error).toBeNull();
      expect(result.data?.slug).toBe("my-new-slug");
    });

    test("updates multiple fields at once", async () => {
      const { organization, user } = await memberFixture({ role: "admin" });
      const headers = await signInAs(user.email, user.password);

      const course = await prisma.course.create({
        data: {
          authorId: Number(user.id),
          description: "Original description",
          language: "en",
          normalizedTitle: "test course",
          organizationId: organization.id,
          slug: `test-course-${randomUUID()}`,
          title: "Test Course",
        },
      });

      const result = await updateCourse({
        courseId: course.id,
        description: "New description",
        headers,
        slug: "new-slug",
        title: "New Title",
      });

      expect(result.error).toBeNull();
      expect(result.data?.title).toBe("New Title");
      expect(result.data?.normalizedTitle).toBe("new title");
      expect(result.data?.description).toBe("New description");
      expect(result.data?.slug).toBe("new-slug");
    });

    test("normalizes title with accents for search", async () => {
      const { organization, user } = await memberFixture({ role: "admin" });
      const headers = await signInAs(user.email, user.password);

      const course = await prisma.course.create({
        data: {
          authorId: Number(user.id),
          description: "Test description",
          language: "pt",
          normalizedTitle: "test course",
          organizationId: organization.id,
          slug: `test-course-${randomUUID()}`,
          title: "Test Course",
        },
      });

      const result = await updateCourse({
        courseId: course.id,
        headers,
        title: "Ciência da Computação",
      });

      expect(result.error).toBeNull();
      expect(result.data?.title).toBe("Ciência da Computação");
      expect(result.data?.normalizedTitle).toBe("ciencia da computacao");
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
          language: "en",
          normalizedTitle: "test course in org2",
          organizationId: org2.id,
          slug: `test-course-org2-${randomUUID()}`,
          title: "Test Course in Org2",
        },
      });

      const result = await updateCourse({
        courseId: courseInOrg2.id,
        headers,
        title: "Hacked Title",
      });

      expect(result.error?.message).toBe("Forbidden");
      expect(result.data).toBeNull();

      const unchangedCourse = await prisma.course.findUnique({
        where: { id: courseInOrg2.id },
      });
      expect(unchangedCourse?.title).toBe("Test Course in Org2");
    });
  });

  describe("owners", () => {
    test("updates title successfully", async () => {
      const { organization, user } = await memberFixture({ role: "owner" });
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

      const result = await updateCourse({
        courseId: course.id,
        headers,
        title: "Owner Updated Title",
      });

      expect(result.error).toBeNull();
      expect(result.data?.title).toBe("Owner Updated Title");
    });
  });
});
