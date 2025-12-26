import { signInAs } from "@zoonk/testing/fixtures/auth";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { describe, expect, test } from "vitest";
import { searchCourses } from "./search-courses";

describe("unauthenticated users", async () => {
  const organization = await organizationFixture();

  await courseFixture({
    isPublished: true,
    normalizedTitle: "searchable course",
    organizationId: organization.id,
    title: "Searchable Course",
  });

  test("returns Forbidden", async () => {
    const result = await searchCourses({
      headers: new Headers(),
      orgSlug: organization.slug,
      title: "searchable",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });
});

describe("non members", async () => {
  const [organization, { user }] = await Promise.all([
    organizationFixture(),
    memberFixture({ role: "member" }),
  ]);

  const [headers, _course] = await Promise.all([
    signInAs(user.email, user.password),
    courseFixture({
      isPublished: true,
      normalizedTitle: "member course",
      organizationId: organization.id,
      title: "Member Course",
    }),
  ]);

  test("returns Forbidden", async () => {
    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "member",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });
});

describe("org admins", async () => {
  const { organization, user } = await memberFixture({ role: "admin" });

  const [headers, draftCourse, publishedCourse] = await Promise.all([
    signInAs(user.email, user.password),
    courseFixture({
      isPublished: false,
      normalizedTitle: "admin draft course",
      organizationId: organization.id,
      title: "Admin Draft Course",
    }),
    courseFixture({
      isPublished: true,
      normalizedTitle: "admin published course",
      organizationId: organization.id,
      title: "Admin Published Course",
    }),
  ]);

  test("returns all matching courses (published and draft)", async () => {
    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "admin",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);

    const ids = result.data.map((c) => c.id);
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
});
