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
  getCourse,
  LIST_COURSES_LIMIT,
  listCourses,
  searchCourses,
  toggleCoursePublished,
  updateCourse,
} from "./courses";

describe("listCourses()", () => {
  test("returns Forbidden error when session is invalid", async () => {
    const organization = await organizationFixture();

    const result = await listCourses({
      headers: new Headers(),
      orgSlug: organization.slug,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });

  test("returns Forbidden error when user is not a member of the organization", async () => {
    const organization = await organizationFixture();
    const { user } = await memberFixture({ role: "member" });
    const headers = await signInAs(user.email, user.password);

    const result = await listCourses({
      headers,
      orgSlug: organization.slug,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });

  test("returns list of courses for an org", async () => {
    const { organization, user } = await memberFixture({ role: "member" });
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
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(course.id);
  });

  test("filters courses by language", async () => {
    const { organization, user } = await memberFixture({ role: "member" });
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
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.language).toBe("en");
  });

  test("limits results to the specified amount", async () => {
    const { organization, user } = await memberFixture({ role: "member" });
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
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(customLimit);
  });

  test("uses default limit of 20", async () => {
    const { organization, user } = await memberFixture({ role: "member" });
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
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(LIST_COURSES_LIMIT);
  });

  test("returns courses ordered by createdAt descending", async () => {
    const { organization, user } = await memberFixture({ role: "member" });
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
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.id).toBe(newCourse.id);
    expect(result.data[1]?.id).toBe(oldCourse.id);
  });
});

describe("courseSlugExists()", () => {
  test("returns true when course with same slug, language, and org exists", async () => {
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

  test("returns false when course doesn't exist", async () => {
    const organization = await organizationFixture();

    const exists = await courseSlugExists({
      language: "en",
      orgSlug: organization.slug,
      slug: "non-existent-slug",
    });

    expect(exists).toBe(false);
  });

  test("returns false when slug matches but different language", async () => {
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

  test("returns false when slug matches but different organization", async () => {
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
  test("returns courses matching the search title", async () => {
    const organization = await organizationFixture();
    const author = await userFixture();

    const matchingCourse = await prisma.course.create({
      data: {
        authorId: Number(author.id),
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
        authorId: Number(author.id),
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
      orgSlug: organization.slug,
      title: "Computer",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(matchingCourse.id);
  });

  test("matches partial words", async () => {
    const organization = await organizationFixture();
    const author = await userFixture();

    const course = await prisma.course.create({
      data: {
        authorId: Number(author.id),
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
      orgSlug: organization.slug,
      title: "comput",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(course.id);
  });

  test("matches words without accents to titles with accents", async () => {
    const organization = await organizationFixture();
    const author = await userFixture();

    const course = await prisma.course.create({
      data: {
        authorId: Number(author.id),
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
      orgSlug: organization.slug,
      title: "ciencia da computacao",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(course.id);
  });

  test("is case-insensitive", async () => {
    const organization = await organizationFixture();
    const author = await userFixture();

    const course = await prisma.course.create({
      data: {
        authorId: Number(author.id),
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
      orgSlug: organization.slug,
      title: "PROGRAMMING",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(course.id);
  });

  test("only returns courses from the specified organization", async () => {
    const org1 = await organizationFixture();
    const org2 = await organizationFixture();
    const author = await userFixture();

    const org1Course = await prisma.course.create({
      data: {
        authorId: Number(author.id),
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
        authorId: Number(author.id),
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
      orgSlug: org1.slug,
      title: "Mathematics",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(org1Course.id);
  });

  test("returns courses ordered by createdAt descending", async () => {
    const organization = await organizationFixture();
    const author = await userFixture();

    const oldCourse = await prisma.course.create({
      data: {
        authorId: Number(author.id),
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
        authorId: Number(author.id),
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
      orgSlug: organization.slug,
      title: "programming",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.id).toBe(newCourse.id);
    expect(result.data[1]?.id).toBe(oldCourse.id);
  });

  test("returns empty array when no courses match", async () => {
    const organization = await organizationFixture();
    const author = await userFixture();

    await prisma.course.create({
      data: {
        authorId: Number(author.id),
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
      orgSlug: organization.slug,
      title: "Physics",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(0);
  });
});

describe("createCourse()", () => {
  test("returns Unauthorized error when session is invalid", async () => {
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

  test("returns Organization not found when org doesn't exist", async () => {
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

  test("returns Forbidden when user doesn't have permission", async () => {
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

  test("creates course when user has admin permission", async () => {
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

  test("creates course when user has owner permission", async () => {
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

  test("normalizes the slug", async () => {
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

  test("normalizes the title for search", async () => {
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

describe("getCourse()", () => {
  test("returns Forbidden when session is invalid", async () => {
    const organization = await organizationFixture();

    const result = await getCourse({
      courseSlug: "test-course",
      headers: new Headers(),
      language: "en",
      orgSlug: organization.slug,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });

  test("returns Forbidden when user is not a member of the organization", async () => {
    const organization = await organizationFixture();
    const { user } = await memberFixture({ role: "member" });
    const headers = await signInAs(user.email, user.password);

    const result = await getCourse({
      courseSlug: "test-course",
      headers,
      language: "en",
      orgSlug: organization.slug,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });

  test("returns course data when user has read permission", async () => {
    const { organization, user } = await memberFixture({ role: "member" });
    const headers = await signInAs(user.email, user.password);
    const slug = `test-course-${randomUUID()}`;

    const course = await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Test description",
        language: "en",
        normalizedTitle: "test course",
        organizationId: organization.id,
        slug,
        title: "Test Course",
      },
    });

    const result = await getCourse({
      courseSlug: slug,
      headers,
      language: "en",
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(course.id);
    expect(result.data?.title).toBe("Test Course");
  });

  test("returns null when course doesn't exist", async () => {
    const { organization, user } = await memberFixture({ role: "member" });
    const headers = await signInAs(user.email, user.password);

    const result = await getCourse({
      courseSlug: "non-existent-course",
      headers,
      language: "en",
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  test("returns null when language doesn't match", async () => {
    const { organization, user } = await memberFixture({ role: "member" });
    const headers = await signInAs(user.email, user.password);
    const slug = `test-course-${randomUUID()}`;

    await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Test description",
        language: "en",
        normalizedTitle: "test course",
        organizationId: organization.id,
        slug,
        title: "Test Course",
      },
    });

    const result = await getCourse({
      courseSlug: slug,
      headers,
      language: "pt",
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  test("returns null when organization doesn't match", async () => {
    const org1 = await organizationFixture();
    const { organization: org2, user } = await memberFixture({
      role: "member",
    });
    const headers = await signInAs(user.email, user.password);
    const slug = `test-course-${randomUUID()}`;

    await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Test description",
        language: "en",
        normalizedTitle: "test course",
        organizationId: org1.id,
        slug,
        title: "Test Course",
      },
    });

    const result = await getCourse({
      courseSlug: slug,
      headers,
      language: "en",
      orgSlug: org2.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });
});

describe("toggleCoursePublished()", () => {
  test("returns Course not found when course doesn't exist", async () => {
    const result = await toggleCoursePublished({
      courseId: 999_999,
      headers: new Headers(),
      isPublished: true,
    });

    expect(result.error?.message).toBe("Course not found");
    expect(result.data).toBeNull();
  });

  test("returns Forbidden when session is invalid", async () => {
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

  test("returns Forbidden when user doesn't have update permission", async () => {
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

  test("successfully toggles when user has admin permission", async () => {
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

  test("successfully toggles when user has owner permission", async () => {
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

  test("returns Forbidden when user tries to update a course from a different organization", async () => {
    const { user } = await memberFixture({ role: "admin" });
    const org2 = await organizationFixture();
    const otherUser = await userFixture();
    const headers = await signInAs(user.email, user.password);

    // Create a course in org2 (different org than user's)
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

    // User has admin permission on org1 but tries to update a course from org2
    const result = await toggleCoursePublished({
      courseId: courseInOrg2.id,
      headers,
      isPublished: true,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();

    // Verify the course was NOT updated
    const unchangedCourse = await prisma.course.findUnique({
      where: { id: courseInOrg2.id },
    });
    expect(unchangedCourse?.isPublished).toBe(false);
  });
});

describe("deleteCourse()", () => {
  test("returns Course not found when course doesn't exist", async () => {
    const result = await deleteCourse({
      courseId: 999_999,
      headers: new Headers(),
    });

    expect(result.error?.message).toBe("Course not found");
    expect(result.data).toBeNull();
  });

  test("returns Forbidden when user is not authenticated", async () => {
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

    // Verify the course was NOT deleted
    const unchangedCourse = await prisma.course.findUnique({
      where: { id: course.id },
    });

    expect(unchangedCourse).not.toBeNull();
  });

  test("returns Forbidden for org members", async () => {
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

    // Verify the course was NOT deleted
    const unchangedCourse = await prisma.course.findUnique({
      where: { id: course.id },
    });

    expect(unchangedCourse).not.toBeNull();
  });

  test("returns Forbidden for org admins", async () => {
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

    // Verify the course was NOT deleted
    const unchangedCourse = await prisma.course.findUnique({
      where: { id: course.id },
    });

    expect(unchangedCourse).not.toBeNull();
  });

  test("deletes course for org owners", async () => {
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

    // Verify the course was deleted
    const deletedCourse = await prisma.course.findUnique({
      where: { id: course.id },
    });
    expect(deletedCourse).toBeNull();
  });

  test("returns Forbidden when user tries to delete a course from a different organization", async () => {
    const { user } = await memberFixture({ role: "admin" });
    const org2 = await organizationFixture();
    const otherUser = await userFixture();
    const headers = await signInAs(user.email, user.password);

    // Create a course in org2 (different org than user's)
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

    // User has admin permission on org1 but tries to delete a course from org2
    const result = await deleteCourse({
      courseId: courseInOrg2.id,
      headers,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();

    // Verify the course was NOT deleted
    const unchangedCourse = await prisma.course.findUnique({
      where: { id: courseInOrg2.id },
    });
    expect(unchangedCourse).not.toBeNull();
  });
});

describe("updateCourse()", () => {
  test("returns Course not found when course doesn't exist", async () => {
    const result = await updateCourse({
      courseId: 999_999,
      headers: new Headers(),
      title: "Updated Title",
    });

    expect(result.error?.message).toBe("Course not found");
    expect(result.data).toBeNull();
  });

  test("returns Forbidden when user is not authenticated", async () => {
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

    // Verify the course was NOT updated
    const unchangedCourse = await prisma.course.findUnique({
      where: { id: course.id },
    });
    expect(unchangedCourse?.title).toBe("Test Course");
  });

  test("returns Forbidden for org members", async () => {
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

    // Verify the course was NOT updated
    const unchangedCourse = await prisma.course.findUnique({
      where: { id: course.id },
    });
    expect(unchangedCourse?.title).toBe("Test Course");
  });

  test("updates course title for org admins", async () => {
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

  test("updates course title for org owners", async () => {
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

  test("updates course description", async () => {
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

  test("updates course slug and normalizes it", async () => {
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

  test("returns Forbidden when user tries to update a course from a different organization", async () => {
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

    // Verify the course was NOT updated
    const unchangedCourse = await prisma.course.findUnique({
      where: { id: courseInOrg2.id },
    });
    expect(unchangedCourse?.title).toBe("Test Course in Org2");
  });
});
