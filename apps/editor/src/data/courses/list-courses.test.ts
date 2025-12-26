import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { listCourses } from "./list-courses";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();

    await Promise.all([
      courseFixture({ isPublished: true, organizationId: organization.id }),
      courseFixture({ isPublished: false, organizationId: organization.id }),
    ]);

    const result = await listCourses({
      headers: new Headers(),
      orgSlug: organization.slug,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });
});

describe("non members", () => {
  test("returns Forbidden", async () => {
    const [organization, { user }] = await Promise.all([
      organizationFixture(),
      memberFixture({ role: "member" }),
    ]);

    const headers = await signInAs(user.email, user.password);

    const result = await listCourses({
      headers,
      orgSlug: organization.slug,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });
});

describe("org members", () => {
  test("returns Forbidden for org members", async () => {
    const { organization, user } = await memberFixture({ role: "member" });

    const [headers] = await Promise.all([
      signInAs(user.email, user.password),
      courseFixture({ isPublished: false, organizationId: organization.id }),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    const result = await listCourses({
      headers,
      orgSlug: organization.slug,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });
});

describe("org admins", () => {
  let organization: Awaited<ReturnType<typeof memberFixture>>["organization"];
  let headers: Headers;
  let draftCourse: Awaited<ReturnType<typeof courseFixture>>;
  let publishedCourse: Awaited<ReturnType<typeof courseFixture>>;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    organization = fixture.organization;

    [headers, draftCourse, publishedCourse] = await Promise.all([
      signInAs(fixture.user.email, fixture.user.password),
      courseFixture({
        isPublished: false,
        organizationId: fixture.organization.id,
      }),
      courseFixture({
        isPublished: true,
        organizationId: fixture.organization.id,
      }),
    ]);
  });

  test("returns all courses (published and draft)", async () => {
    const result = await listCourses({
      headers,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);

    const ids = result.data.map((c) => c.id);
    expect(ids).toContain(draftCourse.id);
    expect(ids).toContain(publishedCourse.id);
  });

  test("filters by language", async () => {
    await courseFixture({
      language: "pt",
      organizationId: organization.id,
    });

    const result = await listCourses({
      headers,
      language: "en",
      orgSlug: organization.slug,
    });

    const hasPtCourse = result.data.some((course) => course.language === "pt");

    expect(result.error).toBeNull();
    expect(hasPtCourse).toBe(false);
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
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(customLimit);
  });

  test("does not include organization data in results", async () => {
    const result = await listCourses({
      headers,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data[0]).not.toHaveProperty("organization");
  });
});
