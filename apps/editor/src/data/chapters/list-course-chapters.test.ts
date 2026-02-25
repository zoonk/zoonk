import { ErrorCode } from "@/lib/app-error";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { memberFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { listCourseChapters } from "./list-course-chapters";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    const result = await listCourseChapters({
      courseSlug: course.slug,
      headers: new Headers(),
      orgSlug: organization.slug,
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

    const result = await listCourseChapters({
      courseSlug: course.slug,
      headers,
      orgSlug: organization.slug,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toEqual([]);
  });
});

describe("admins", () => {
  let organization: Awaited<ReturnType<typeof memberFixture>>["organization"];
  let headers: Headers;
  let _course: Awaited<ReturnType<typeof courseFixture>>;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    organization = fixture.organization;

    [headers, _course] = await Promise.all([
      signInAs(fixture.user.email, fixture.user.password),
      courseFixture({ organizationId: fixture.organization.id }),
    ]);
  });

  test("lists chapters for a course ordered by position", async () => {
    const newCourse = await courseFixture({ organizationId: organization.id });

    const [chapter1, chapter2, chapter3] = await Promise.all([
      chapterFixture({
        courseId: newCourse.id,
        language: newCourse.language,
        organizationId: organization.id,
        position: 2,
      }),
      chapterFixture({
        courseId: newCourse.id,
        language: newCourse.language,
        organizationId: organization.id,
        position: 0,
      }),
      chapterFixture({
        courseId: newCourse.id,
        language: newCourse.language,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    const result = await listCourseChapters({
      courseSlug: newCourse.slug,
      headers,
      orgSlug: organization.slug,
    });

    const expectedChapterCount = 3;

    expect(result.error).toBeNull();
    expect(result.data.length).toBe(expectedChapterCount);
    expect(result.data[0]?.id).toBe(chapter2.id);
    expect(result.data[0]?.position).toBe(0);
    expect(result.data[1]?.id).toBe(chapter3.id);
    expect(result.data[1]?.position).toBe(1);
    expect(result.data[2]?.id).toBe(chapter1.id);
    expect(result.data[2]?.position).toBe(2);
  });

  test("returns empty array when course has no chapters", async () => {
    const emptyCourse = await courseFixture({
      organizationId: organization.id,
    });

    const result = await listCourseChapters({
      courseSlug: emptyCourse.slug,
      headers,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  test("returns empty array when course not found", async () => {
    const result = await listCourseChapters({
      courseSlug: "non-existent-course",
      headers,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  test("returns Forbidden for course in different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });

    const result = await listCourseChapters({
      courseSlug: otherCourse.slug,
      headers,
      orgSlug: otherOrg.slug,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toEqual([]);
  });
});
