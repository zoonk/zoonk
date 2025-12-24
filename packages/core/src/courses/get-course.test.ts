import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { describe, expect, test } from "vitest";
import { signInAs } from "@/fixtures/auth";
import { memberFixture, organizationFixture } from "@/fixtures/organizations";
import { userFixture } from "@/fixtures/users";
import { getCourse } from "./get-course";

describe("brand org: unauthenticated users", () => {
  test("returns Forbidden for visibility draft", async () => {
    const organization = await organizationFixture({ kind: "brand" });
    const author = await userFixture();
    const slug = `test-course-${randomUUID()}`;

    await prisma.course.create({
      data: {
        authorId: Number(author.id),
        description: "Test description",
        isPublished: false,
        language: "en",
        normalizedTitle: "test course",
        organizationId: organization.id,
        slug,
        title: "Test Course",
      },
    });

    const result = await getCourse({
      courseSlug: slug,
      headers: new Headers(),
      language: "en",
      orgSlug: organization.slug,
      visibility: "draft",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });

  test("returns published course for visibility published", async () => {
    const organization = await organizationFixture({ kind: "brand" });
    const author = await userFixture();
    const slug = `test-course-${randomUUID()}`;

    const course = await prisma.course.create({
      data: {
        authorId: Number(author.id),
        description: "Published course",
        isPublished: true,
        language: "en",
        normalizedTitle: "published course",
        organizationId: organization.id,
        slug,
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

    const result = await getCourse({
      courseSlug: slug,
      headers: new Headers(),
      language: "en",
      orgSlug: organization.slug,
      visibility: "published",
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(course.id);
  });
});

describe("brand org: members", () => {
  test("returns Forbidden for visibility draft", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "member",
    });
    const headers = await signInAs(user.email, user.password);
    const slug = `test-course-${randomUUID()}`;

    await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Test description",
        isPublished: false,
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
      visibility: "draft",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });

  test("returns published course for visibility published", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "member",
    });
    const headers = await signInAs(user.email, user.password);
    const slug = `test-course-${randomUUID()}`;

    const course = await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Test description",
        isPublished: true,
        language: "en",
        normalizedTitle: "test course",
        organizationId: organization.id,
        slug,
        title: "Test Course",
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

    const result = await getCourse({
      courseSlug: slug,
      headers,
      language: "en",
      orgSlug: organization.slug,
      visibility: "published",
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(course.id);
    expect(result.data?.title).toBe("Test Course");
  });

  test("returns null when course does not exist", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "member",
    });
    const headers = await signInAs(user.email, user.password);

    const result = await getCourse({
      courseSlug: "non-existent-course",
      headers,
      language: "en",
      orgSlug: organization.slug,
      visibility: "published",
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  test("returns null when language does not match", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "member",
    });
    const headers = await signInAs(user.email, user.password);
    const slug = `test-course-${randomUUID()}`;

    await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Test description",
        isPublished: true,
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
      visibility: "published",
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  test("returns null when organization does not match", async () => {
    const org1 = await organizationFixture({ kind: "brand" });
    const { organization: org2, user } = await memberFixture({
      orgKind: "brand",
      role: "member",
    });
    const headers = await signInAs(user.email, user.password);
    const slug = `test-course-${randomUUID()}`;

    await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Test description",
        isPublished: true,
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
      visibility: "published",
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });
});

describe("brand org: admins", () => {
  test("returns draft course for visibility draft", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "admin",
    });
    const headers = await signInAs(user.email, user.password);
    const slug = `test-course-${randomUUID()}`;

    const course = await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Test description",
        isPublished: false,
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
      visibility: "draft",
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(course.id);
    expect(result.data?.title).toBe("Test Course");
  });

  test("returns course for visibility all", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "admin",
    });
    const headers = await signInAs(user.email, user.password);
    const slug = `test-course-${randomUUID()}`;

    const course = await prisma.course.create({
      data: {
        authorId: Number(user.id),
        description: "Test description",
        isPublished: false,
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
      visibility: "all",
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(course.id);
  });

  test("returns null when course does not exist", async () => {
    const { organization, user } = await memberFixture({
      orgKind: "brand",
      role: "admin",
    });
    const headers = await signInAs(user.email, user.password);

    const result = await getCourse({
      courseSlug: "non-existent-course",
      headers,
      language: "en",
      orgSlug: organization.slug,
      visibility: "all",
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });
});

describe("school org: unauthenticated users", () => {
  test("returns Forbidden for visibility published", async () => {
    const organization = await organizationFixture({ kind: "school" });
    const author = await userFixture();
    const slug = `test-course-${randomUUID()}`;

    await prisma.course.create({
      data: {
        authorId: Number(author.id),
        description: "Test description",
        isPublished: true,
        language: "en",
        normalizedTitle: "test course",
        organizationId: organization.id,
        slug,
        title: "Test Course",
      },
    });

    const result = await getCourse({
      courseSlug: slug,
      headers: new Headers(),
      language: "en",
      orgSlug: organization.slug,
      visibility: "published",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });
});

describe("school org: non-members", () => {
  test("returns Forbidden for visibility published", async () => {
    const organization = await organizationFixture({ kind: "school" });
    const { user } = await memberFixture({ role: "member" });
    const author = await userFixture();
    const headers = await signInAs(user.email, user.password);
    const slug = `test-course-${randomUUID()}`;

    await prisma.course.create({
      data: {
        authorId: Number(author.id),
        description: "Test description",
        isPublished: true,
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
      visibility: "published",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });
});
