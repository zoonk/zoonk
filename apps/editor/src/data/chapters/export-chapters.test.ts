import { ErrorCode } from "@/lib/app-error";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { memberFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { exportChapters } from "./export-chapters";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    const result = await exportChapters({
      courseId: course.id,
      headers: new Headers(),
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("members", () => {
  test("returns Forbidden", async () => {
    const { organization, user } = await memberFixture({ role: "member" });

    const [headers, course] = await Promise.all([
      signInAs(user.email, user.password),
      courseFixture({ organizationId: organization.id }),
    ]);

    const result = await exportChapters({
      courseId: course.id,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
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

  test("exports chapters successfully", async () => {
    const newCourse = await courseFixture({ organizationId: organization.id });

    await Promise.all([
      chapterFixture({
        courseId: newCourse.id,
        language: newCourse.language,
        organizationId: organization.id,
        position: 0,
        title: "Chapter 1",
      }),
      chapterFixture({
        courseId: newCourse.id,
        language: newCourse.language,
        organizationId: organization.id,
        position: 1,
        title: "Chapter 2",
      }),
    ]);

    const result = await exportChapters({
      courseId: newCourse.id,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
    expect(result.data?.version).toBe(1);
    expect(result.data?.exportedAt).toBeDefined();
    expect(result.data?.chapters).toHaveLength(2);
    expect(result.data?.chapters[0]?.title).toBe("Chapter 1");
    expect(result.data?.chapters[0]?.position).toBe(0);
    expect(result.data?.chapters[1]?.title).toBe("Chapter 2");
    expect(result.data?.chapters[1]?.position).toBe(1);
  });

  test("exports empty chapters array when course has no chapters", async () => {
    const result = await exportChapters({
      courseId: course.id,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data?.chapters).toEqual([]);
  });

  test("returns Course not found for non-existent course", async () => {
    const result = await exportChapters({
      courseId: 999_999,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.courseNotFound);
    expect(result.data).toBeNull();
  });

  test("don't allow exporting chapters from a different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });

    const result = await exportChapters({
      courseId: otherCourse.id,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });

  test("exports chapters in correct order", async () => {
    const newCourse = await courseFixture({ organizationId: organization.id });

    await Promise.all([
      chapterFixture({
        courseId: newCourse.id,
        language: newCourse.language,
        organizationId: organization.id,
        position: 2,
        title: "Third",
      }),
      chapterFixture({
        courseId: newCourse.id,
        language: newCourse.language,
        organizationId: organization.id,
        position: 0,
        title: "First",
      }),
      chapterFixture({
        courseId: newCourse.id,
        language: newCourse.language,
        organizationId: organization.id,
        position: 1,
        title: "Second",
      }),
    ]);

    const result = await exportChapters({
      courseId: newCourse.id,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data?.chapters).toHaveLength(3);
    expect(result.data?.chapters[0]?.title).toBe("First");
    expect(result.data?.chapters[0]?.position).toBe(0);
    expect(result.data?.chapters[1]?.title).toBe("Second");
    expect(result.data?.chapters[1]?.position).toBe(1);
    expect(result.data?.chapters[2]?.title).toBe("Third");
    expect(result.data?.chapters[2]?.position).toBe(2);
  });

  test("includes all chapter fields in export", async () => {
    const newCourse = await courseFixture({ organizationId: organization.id });

    await chapterFixture({
      courseId: newCourse.id,
      description: "Test Description",
      language: newCourse.language,
      organizationId: organization.id,
      position: 0,
      slug: "test-slug",
      title: "Test Title",
    });

    const result = await exportChapters({
      courseId: newCourse.id,
      headers,
    });

    expect(result.error).toBeNull();

    expect(result.data?.chapters[0]).toEqual({
      description: "Test Description",
      position: 0,
      slug: "test-slug",
      title: "Test Title",
    });
  });
});
