import { signInAs } from "@zoonk/testing/fixtures/auth";
import {
  chapterFixture,
  courseChapterFixture,
} from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { describe, expect, test } from "vitest";
import { listCourseChapters } from "./list-course-chapters";

describe("unauthenticated users", async () => {
  const organization = await organizationFixture();
  const course = await courseFixture({ organizationId: organization.id });

  test("returns Forbidden", async () => {
    const result = await listCourseChapters({
      courseSlug: course.slug,
      headers: new Headers(),
      language: course.language,
      orgSlug: organization.slug,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });
});

describe("members", async () => {
  const { organization, user } = await memberFixture({ role: "member" });

  const [headers, course] = await Promise.all([
    signInAs(user.email, user.password),
    courseFixture({ organizationId: organization.id }),
  ]);

  test("returns Forbidden", async () => {
    const result = await listCourseChapters({
      courseSlug: course.slug,
      headers,
      language: course.language,
      orgSlug: organization.slug,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });
});

describe("admins", async () => {
  const { organization, user } = await memberFixture({ role: "admin" });

  const [headers, course] = await Promise.all([
    signInAs(user.email, user.password),
    courseFixture({ organizationId: organization.id }),
  ]);

  test("lists chapters for a course ordered by position", async () => {
    const [chapter1, chapter2, chapter3] = await Promise.all([
      chapterFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
    ]);

    await Promise.all([
      courseChapterFixture({
        chapterId: chapter1.id,
        courseId: course.id,
        position: 2,
      }),
      courseChapterFixture({
        chapterId: chapter2.id,
        courseId: course.id,
        position: 0,
      }),
      courseChapterFixture({
        chapterId: chapter3.id,
        courseId: course.id,
        position: 1,
      }),
    ]);

    const result = await listCourseChapters({
      courseSlug: course.slug,
      headers,
      language: course.language,
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
      language: emptyCourse.language,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  test("returns empty array when course not found", async () => {
    const result = await listCourseChapters({
      courseSlug: "non-existent-course",
      headers,
      language: "en",
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
      language: otherCourse.language,
      orgSlug: otherOrg.slug,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });
});
