import { ErrorCode } from "@/lib/app-error";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { memberFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { searchCourses } from "./search-courses";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();

    await courseFixture({
      isPublished: true,
      normalizedTitle: "searchable course",
      organizationId: organization.id,
      title: "Searchable Course",
    });

    const result = await searchCourses({
      headers: new Headers(),
      orgSlug: organization.slug,
      title: "searchable",
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toEqual([]);
  });
});

describe("non members", () => {
  test("returns Forbidden", async () => {
    const [organization, { user }] = await Promise.all([
      organizationFixture(),
      memberFixture({ role: "member" }),
    ]);

    const [headers] = await Promise.all([
      signInAs(user.email, user.password),
      courseFixture({
        isPublished: true,
        normalizedTitle: "member course",
        organizationId: organization.id,
        title: "Member Course",
      }),
    ]);

    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "member",
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
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
        normalizedTitle: "admin draft course",
        organizationId: fixture.organization.id,
        title: "Admin Draft Course",
      }),
      courseFixture({
        isPublished: true,
        normalizedTitle: "admin published course",
        organizationId: fixture.organization.id,
        title: "Admin Published Course",
      }),
    ]);
  });

  test("returns all matching courses (published and draft)", async () => {
    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "admin",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);

    const ids = result.data.map((course) => course.id);
    expect(ids).toContain(draftCourse.id);
    expect(ids).toContain(publishedCourse.id);
  });

  test("returns empty array when search term does not match", async () => {
    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "nonexistent",
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  test("search is case insensitive", async () => {
    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "ADMIN",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBeGreaterThan(0);
  });

  test("search matches partial titles", async () => {
    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "adm",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBeGreaterThan(0);
  });

  test("filters by language", async () => {
    await courseFixture({
      isPublished: true,
      language: "pt",
      normalizedTitle: "admin portuguese course",
      organizationId: organization.id,
      title: "Admin Portuguese Course",
    });

    const result = await searchCourses({
      headers,
      language: "en",
      orgSlug: organization.slug,
      title: "admin",
    });

    const hasPtCourse = result.data.some((course) => course.language === "pt");

    expect(result.error).toBeNull();
    expect(hasPtCourse).toBe(false);
  });

  test("does not include organization data in results", async () => {
    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "admin",
    });

    expect(result.error).toBeNull();
    expect(result.data[0]).not.toHaveProperty("organization");
  });

  test("limits results to default of 10", async () => {
    await Promise.all(
      Array.from({ length: 15 }, (_, i) =>
        courseFixture({
          isPublished: true,
          normalizedTitle: `limit test course ${i}`,
          organizationId: organization.id,
          title: `Limit Test Course ${i}`,
        }),
      ),
    );

    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "Limit Test",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(10);
  });

  test("respects custom limit parameter", async () => {
    await Promise.all(
      Array.from({ length: 15 }, (_, i) =>
        courseFixture({
          isPublished: true,
          normalizedTitle: `custom limit test course ${i}`,
          organizationId: organization.id,
          title: `Custom Limit Test Course ${i}`,
        }),
      ),
    );

    const result = await searchCourses({
      headers,
      limit: 5,
      orgSlug: organization.slug,
      title: "Custom Limit Test",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(5);
  });

  test("returns exact match first", async () => {
    const uniqueId = crypto.randomUUID().slice(0, 8);
    const searchTerm = `exactmatch${uniqueId}`;

    const [exactMatch, containsMatch1, containsMatch2] = await Promise.all([
      courseFixture({
        isPublished: true,
        normalizedTitle: searchTerm,
        organizationId: organization.id,
        title: searchTerm,
      }),
      courseFixture({
        isPublished: true,
        normalizedTitle: `${searchTerm} on rails`,
        organizationId: organization.id,
        title: `${searchTerm} on Rails`,
      }),
      courseFixture({
        isPublished: true,
        normalizedTitle: `advanced ${searchTerm} programming`,
        organizationId: organization.id,
        title: `Advanced ${searchTerm} Programming`,
      }),
    ]);

    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: searchTerm,
    });

    expect(result.error).toBeNull();

    const ids = result.data.map((course) => course.id);

    expect(ids).toContain(exactMatch.id);
    expect(ids).toContain(containsMatch1.id);
    expect(ids).toContain(containsMatch2.id);
    expect(result.data[0]?.id).toBe(exactMatch.id);
  });
});
