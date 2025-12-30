import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { ErrorCode } from "@/lib/app-error";
import { searchOrgChapters } from "./search-org-chapters";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();

    const result = await searchOrgChapters({
      headers: new Headers(),
      orgSlug: organization.slug,
      title: "test",
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toEqual([]);
  });
});

describe("members", () => {
  test("returns Forbidden", async () => {
    const { organization, user } = await memberFixture({ role: "member" });
    const headers = await signInAs(user.email, user.password);

    const result = await searchOrgChapters({
      headers,
      orgSlug: organization.slug,
      title: "test",
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toEqual([]);
  });
});

describe("admins", () => {
  let organization: Awaited<ReturnType<typeof memberFixture>>["organization"];
  let headers: Headers;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    organization = fixture.organization;
    headers = await signInAs(fixture.user.email, fixture.user.password);
  });

  test("searches all chapters in organization by title", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    await Promise.all([
      chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: organization.id,
        position: 0,
        title: "Learn JavaScript Basics",
      }),
      chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: organization.id,
        position: 1,
        title: "Advanced Python Techniques",
      }),
      chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: organization.id,
        position: 2,
        title: "JavaScript Functions",
      }),
    ]);

    const result = await searchOrgChapters({
      headers,
      orgSlug: organization.slug,
      title: "javascript",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBe(2);
  });

  test("searches with normalized title (removes accents)", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
      position: 0,
      title: "Introdução à Programação",
    });

    const result = await searchOrgChapters({
      headers,
      orgSlug: organization.slug,
      title: "programacao",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(
      result.data.some((c) => c.title === "Introdução à Programação"),
    ).toBe(true);
  });

  test("returns empty array when no matches", async () => {
    const result = await searchOrgChapters({
      headers,
      orgSlug: organization.slug,
      title: "xyznonexistent123",
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  test("returns Forbidden for chapter in different organization", async () => {
    const otherOrg = await organizationFixture();

    const result = await searchOrgChapters({
      headers,
      orgSlug: otherOrg.slug,
      title: "test",
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toEqual([]);
  });

  test("case insensitive search", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
      position: 0,
      title: "UPPERCASE TITLE",
    });

    const result = await searchOrgChapters({
      headers,
      orgSlug: organization.slug,
      title: "uppercase",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(result.data.some((c) => c.title === "UPPERCASE TITLE")).toBe(true);
  });

  test("partial match search", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
      position: 0,
      title: "Very Long Chapter Title For Testing",
    });

    const result = await searchOrgChapters({
      headers,
      orgSlug: organization.slug,
      title: "Long Chapter",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(
      result.data.some(
        (c) => c.title === "Very Long Chapter Title For Testing",
      ),
    ).toBe(true);
  });

  test("includes course info in results", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
      position: 0,
      title: "Chapter With Course Info",
    });

    const result = await searchOrgChapters({
      headers,
      orgSlug: organization.slug,
      title: "Chapter With Course",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBeGreaterThanOrEqual(1);

    const chapter = result.data.find(
      (c) => c.title === "Chapter With Course Info",
    );

    expect(chapter?.course).toBeDefined();
    expect(chapter?.course.slug).toBe(course.slug);
    expect(chapter?.course.language).toBe(course.language);
  });

  test("limits results to default of 10", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    await Promise.all(
      Array.from({ length: 15 }, (_, i) =>
        chapterFixture({
          courseId: course.id,
          language: course.language,
          organizationId: organization.id,
          position: i,
          title: `Limit Test Chapter ${i}`,
        }),
      ),
    );

    const result = await searchOrgChapters({
      headers,
      orgSlug: organization.slug,
      title: "Limit Test",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(10);
  });

  test("respects custom limit parameter", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    await Promise.all(
      Array.from({ length: 15 }, (_, i) =>
        chapterFixture({
          courseId: course.id,
          language: course.language,
          organizationId: organization.id,
          position: i,
          title: `Custom Limit Test Chapter ${i}`,
        }),
      ),
    );

    const result = await searchOrgChapters({
      headers,
      limit: 5,
      orgSlug: organization.slug,
      title: "Custom Limit Test",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(5);
  });
});
