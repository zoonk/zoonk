import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { ErrorCode } from "@/lib/app-error";
import { searchCourseChapters } from "./search-course-chapters";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    const result = await searchCourseChapters({
      courseSlug: course.slug,
      headers: new Headers(),
      language: course.language,
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

    const [headers, course] = await Promise.all([
      signInAs(user.email, user.password),
      courseFixture({ organizationId: organization.id }),
    ]);

    const result = await searchCourseChapters({
      courseSlug: course.slug,
      headers,
      language: course.language,
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
  let course: Awaited<ReturnType<typeof courseFixture>>;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    organization = fixture.organization;

    [headers, course] = await Promise.all([
      signInAs(fixture.user.email, fixture.user.password),
      courseFixture({ organizationId: fixture.organization.id }),
    ]);
  });

  test("searches chapters by title", async () => {
    const newCourse = await courseFixture({ organizationId: organization.id });

    await Promise.all([
      chapterFixture({
        courseId: newCourse.id,
        language: newCourse.language,
        organizationId: organization.id,
        position: 0,
        title: "Introduction to JavaScript",
      }),
      chapterFixture({
        courseId: newCourse.id,
        language: newCourse.language,
        organizationId: organization.id,
        position: 1,
        title: "Advanced Python",
      }),
    ]);

    const result = await searchCourseChapters({
      courseSlug: newCourse.slug,
      headers,
      language: newCourse.language,
      orgSlug: organization.slug,
      title: "javascript",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBe(1);
    expect(result.data[0]?.title).toBe("Introduction to JavaScript");
  });

  test("searches with normalized title (removes accents)", async () => {
    const newCourse = await courseFixture({ organizationId: organization.id });

    await chapterFixture({
      courseId: newCourse.id,
      language: newCourse.language,
      organizationId: organization.id,
      position: 0,
      title: "Introdução à Programação",
    });

    const result = await searchCourseChapters({
      courseSlug: newCourse.slug,
      headers,
      language: newCourse.language,
      orgSlug: organization.slug,
      title: "programacao",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBe(1);
    expect(result.data[0]?.title).toBe("Introdução à Programação");
  });

  test("returns empty array when no matches", async () => {
    const result = await searchCourseChapters({
      courseSlug: course.slug,
      headers,
      language: course.language,
      orgSlug: organization.slug,
      title: "nonexistent",
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  test("returns Forbidden for course in different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });

    const result = await searchCourseChapters({
      courseSlug: otherCourse.slug,
      headers,
      language: otherCourse.language,
      orgSlug: otherOrg.slug,
      title: "test",
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toEqual([]);
  });

  test("includes position in results", async () => {
    const newCourse = await courseFixture({ organizationId: organization.id });
    const expectedPosition = 5;

    await chapterFixture({
      courseId: newCourse.id,
      language: newCourse.language,
      organizationId: organization.id,
      position: expectedPosition,
      title: "Unique Searchable Title",
    });

    const result = await searchCourseChapters({
      courseSlug: newCourse.slug,
      headers,
      language: newCourse.language,
      orgSlug: organization.slug,
      title: "Unique Searchable",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBe(1);
    expect(result.data[0]?.position).toBe(expectedPosition);
  });
});
