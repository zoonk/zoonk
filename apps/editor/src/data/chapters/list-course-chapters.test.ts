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
      courseId: course.id,
      headers: new Headers(),
      orgId: organization.id,
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
      courseId: course.id,
      headers,
      orgId: organization.id,
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
      courseId: newCourse.id,
      headers,
      orgId: organization.id,
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
      courseId: emptyCourse.id,
      headers,
      orgId: organization.id,
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  test("returns Forbidden for course in different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });

    const result = await listCourseChapters({
      courseId: otherCourse.id,
      headers,
      orgId: otherOrg.id,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toEqual([]);
  });
});
