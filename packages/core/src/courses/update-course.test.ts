import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { describe, expect, test } from "vitest";
import { signInAs } from "@/fixtures/auth";
import { memberFixture, organizationFixture } from "@/fixtures/organizations";
import { userFixture } from "@/fixtures/users";
import { updateCourse } from "./update-course";

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
