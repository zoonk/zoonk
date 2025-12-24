import { describe, expect, test } from "vitest";
import { signInAs } from "@/fixtures/auth";
import { courseFixture } from "@/fixtures/courses";
import { memberFixture, organizationFixture } from "@/fixtures/orgs";
import { searchCourses } from "./search-courses";

describe("brand org: unauthenticated users", async () => {
  const organization = await organizationFixture({ kind: "brand" });

  const [publishedCourse] = await Promise.all([
    courseFixture({
      isPublished: true,
      normalizedTitle: "searchable course",
      organizationId: organization.id,
      title: "Searchable Course",
    }),
    courseFixture({
      isPublished: false,
      normalizedTitle: "draft searchable course",
      organizationId: organization.id,
      title: "Draft Searchable Course",
    }),
  ]);

  test("returns Forbidden for visibility all", async () => {
    const result = await searchCourses({
      headers: new Headers(),
      orgSlug: organization.slug,
      title: "searchable",
      visibility: "all",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });

  test("returns Forbidden for visibility draft", async () => {
    const result = await searchCourses({
      headers: new Headers(),
      orgSlug: organization.slug,
      title: "searchable",
      visibility: "draft",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });

  test("returns published courses for visibility published", async () => {
    const result = await searchCourses({
      headers: new Headers(),
      orgSlug: organization.slug,
      title: "searchable",
      visibility: "published",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(publishedCourse.id);
  });

  test("returns empty array when no courses match search term", async () => {
    const result = await searchCourses({
      headers: new Headers(),
      orgSlug: organization.slug,
      title: "nonexistent",
      visibility: "published",
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  test("search is case insensitive", async () => {
    const result = await searchCourses({
      headers: new Headers(),
      orgSlug: organization.slug,
      title: "SEARCHABLE",
      visibility: "published",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(publishedCourse.id);
  });

  test("search matches partial titles", async () => {
    const result = await searchCourses({
      headers: new Headers(),
      orgSlug: organization.slug,
      title: "search",
      visibility: "published",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(publishedCourse.id);
  });
});

describe("non-brand orgs: unauthenticated users", async () => {
  const organization = await organizationFixture({ kind: "school" });

  await courseFixture({
    isPublished: true,
    normalizedTitle: "school course",
    organizationId: organization.id,
    title: "School Course",
  });

  test("returns Forbidden for visibility published", async () => {
    const result = await searchCourses({
      headers: new Headers(),
      orgSlug: organization.slug,
      title: "school",
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

  await courseFixture({
    isPublished: true,
    normalizedTitle: "member course",
    organizationId: organization.id,
    title: "Member Course",
  });

  const headers = await signInAs(user.email, user.password);

  test("returns Forbidden for visibility all", async () => {
    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "member",
      visibility: "all",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });

  test("returns Forbidden for visibility draft", async () => {
    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "member",
      visibility: "draft",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });

  test("returns Forbidden for visibility published", async () => {
    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "member",
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

  const [headers, _draftCourse, publishedCourse] = await Promise.all([
    signInAs(user.email, user.password),
    courseFixture({
      isPublished: false,
      normalizedTitle: "member draft course",
      organizationId: organization.id,
      title: "Member Draft Course",
    }),
    courseFixture({
      isPublished: true,
      normalizedTitle: "member published course",
      organizationId: organization.id,
      title: "Member Published Course",
    }),
  ]);

  test("returns Forbidden for visibility all", async () => {
    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "member",
      visibility: "all",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });

  test("returns Forbidden for visibility draft", async () => {
    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "member",
      visibility: "draft",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });

  test("returns only published courses for visibility published", async () => {
    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "member",
      visibility: "published",
    });

    const hasDraftCourse = result.data.some((course) => !course.isPublished);

    expect(result.error).toBeNull();
    expect(hasDraftCourse).toBe(false);
    expect(result.data[0]?.id).toBe(publishedCourse.id);
  });

  test("filters by language", async () => {
    await courseFixture({
      isPublished: true,
      language: "pt",
      normalizedTitle: "member portuguese course",
      organizationId: organization.id,
      title: "Member Portuguese Course",
    });

    const result = await searchCourses({
      headers,
      language: "en",
      orgSlug: organization.slug,
      title: "member",
      visibility: "published",
    });

    const hasPtCourse = result.data.some((course) => course.language === "pt");

    expect(result.error).toBeNull();
    expect(hasPtCourse).toBe(false);
    expect(result.data[0]?.language).toBe("en");
  });

  test("does not include organization data in results", async () => {
    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "member",
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

  test("returns all matching courses for visibility all", async () => {
    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "admin",
      visibility: "all",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);
  });

  test("returns only draft courses for visibility draft", async () => {
    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "admin",
      visibility: "draft",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(draftCourse.id);
  });

  test("returns only published courses for visibility published", async () => {
    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "admin",
      visibility: "published",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(publishedCourse.id);
  });

  test("returns empty array when search term does not match", async () => {
    const result = await searchCourses({
      headers,
      orgSlug: organization.slug,
      title: "nonexistent",
      visibility: "all",
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });
});
