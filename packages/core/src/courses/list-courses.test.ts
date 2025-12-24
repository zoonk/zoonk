import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { describe, expect, test } from "vitest";
import { signInAs } from "@/fixtures/auth";
import { courseFixture } from "@/fixtures/courses";
import { memberFixture, organizationFixture } from "@/fixtures/orgs";
import { listCourses } from "./list-courses";

describe("brand org: unauthenticated users", async () => {
  const organization = await organizationFixture({ kind: "brand" });

  const [publishedCourse] = await Promise.all([
    courseFixture({ isPublished: true, organizationId: organization.id }),
    courseFixture({ isPublished: false, organizationId: organization.id }),
  ]);

  test("returns Forbidden for visibility all", async () => {
    const result = await listCourses({
      headers: new Headers(),
      orgSlug: organization.slug,
      visibility: "all",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });

  test("returns Forbidden for visibility draft", async () => {
    const result = await listCourses({
      headers: new Headers(),
      orgSlug: organization.slug,
      visibility: "draft",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });

  test("returns published courses for visibility published", async () => {
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

describe("non-brand orgs: unauthenticated users", async () => {
  const organization = await organizationFixture({ kind: "school" });
  await courseFixture({ isPublished: true, organizationId: organization.id });

  test("returns Forbidden for visibility published", async () => {
    const result = await listCourses({
      headers: new Headers(),
      orgSlug: organization.slug,
      visibility: "published",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });
});

describe("non members", async () => {
  const [organization, { user }] = await Promise.all([
    organizationFixture({ kind: "school" }),
    memberFixture({ role: "member" }),
  ]);

  const headers = await signInAs(user.email, user.password);

  test("returns Forbidden for visibility all", async () => {
    const result = await listCourses({
      headers,
      orgSlug: organization.slug,
      visibility: "all",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });

  test("returns Forbidden for visibility draft", async () => {
    const result = await listCourses({
      headers,
      orgSlug: organization.slug,
      visibility: "draft",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });

  test("returns Forbidden for visibility published", async () => {
    const result = await listCourses({
      headers,
      orgSlug: organization.slug,
      visibility: "published",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });
});

describe("org members", async () => {
  const { organization, user } = await memberFixture({
    orgKind: "brand",
    role: "member",
  });

  const [headers, _draftCourse, _publishedCourse] = await Promise.all([
    signInAs(user.email, user.password),
    courseFixture({ isPublished: false, organizationId: organization.id }),
    courseFixture({ isPublished: true, organizationId: organization.id }),
  ]);

  test("returns Forbidden for visibility all", async () => {
    const result = await listCourses({
      headers,
      orgSlug: organization.slug,
      visibility: "all",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });

  test("returns Forbidden for visibility draft", async () => {
    const result = await listCourses({
      headers,
      orgSlug: organization.slug,
      visibility: "draft",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });

  test("returns only published courses for visibility published", async () => {
    const result = await listCourses({
      headers,
      orgSlug: organization.slug,
      visibility: "published",
    });

    const hasDraftCourse = result.data.some((course) => !course.isPublished);

    expect(result.error).toBeNull();
    expect(hasDraftCourse).toBe(false);
    expect(result.data[0]?.isPublished).toBe(true);
  });

  test("filters by language", async () => {
    await courseFixture({ language: "pt", organizationId: organization.id });

    const result = await listCourses({
      headers,
      language: "en",
      orgSlug: organization.slug,
      visibility: "published",
    });

    const hasPtCourse = result.data.some((course) => course.language === "pt");

    expect(result.error).toBeNull();
    expect(hasPtCourse).toBe(false);
    expect(result.data[0]?.language).toBe("en");
  });

  test("limits results to specified amount", async () => {
    await prisma.course.createMany({
      data: Array.from({ length: 5 }, (_, i) => ({
        description: `Course ${i} description`,
        imageUrl: "https://example.com/image.jpg",
        isPublished: true,
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
      visibility: "published",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(customLimit);
  });

  test("does not include organization data in results", async () => {
    const result = await listCourses({
      headers,
      orgSlug: organization.slug,
      visibility: "published",
    });

    expect(result.error).toBeNull();
    expect(result.data[0]).not.toHaveProperty("organization");
  });
});

describe("org admins", async () => {
  const { organization, user } = await memberFixture({
    orgKind: "brand",
    role: "admin",
  });

  const [headers, draftCourse, _publishedCourse] = await Promise.all([
    signInAs(user.email, user.password),
    courseFixture({ isPublished: false, organizationId: organization.id }),
    courseFixture({ isPublished: true, organizationId: organization.id }),
  ]);

  test("returns all courses for visibility all", async () => {
    const result = await listCourses({
      headers,
      orgSlug: organization.slug,
      visibility: "all",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);
  });

  test("returns only draft courses for visibility draft", async () => {
    const result = await listCourses({
      headers,
      orgSlug: organization.slug,
      visibility: "draft",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(draftCourse.id);
  });
});
