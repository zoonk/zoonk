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
import { searchCourseChapters } from "./search-course-chapters";

describe("unauthenticated users", async () => {
  const organization = await organizationFixture();
  const course = await courseFixture({ organizationId: organization.id });

  test("returns Forbidden", async () => {
    const result = await searchCourseChapters({
      courseSlug: course.slug,
      headers: new Headers(),
      language: course.language,
      orgSlug: organization.slug,
      title: "test",
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
    const result = await searchCourseChapters({
      courseSlug: course.slug,
      headers,
      language: course.language,
      orgSlug: organization.slug,
      title: "test",
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

  test("searches chapters by title", async () => {
    const [chapter1, chapter2] = await Promise.all([
      chapterFixture({
        organizationId: organization.id,
        title: "Introduction to JavaScript",
      }),
      chapterFixture({
        organizationId: organization.id,
        title: "Advanced Python",
      }),
    ]);

    await Promise.all([
      courseChapterFixture({
        chapterId: chapter1.id,
        courseId: course.id,
        position: 0,
      }),
      courseChapterFixture({
        chapterId: chapter2.id,
        courseId: course.id,
        position: 1,
      }),
    ]);

    const result = await searchCourseChapters({
      courseSlug: course.slug,
      headers,
      language: course.language,
      orgSlug: organization.slug,
      title: "javascript",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBe(1);
    expect(result.data[0]?.id).toBe(chapter1.id);
  });

  test("searches with normalized title (removes accents)", async () => {
    const chapter = await chapterFixture({
      organizationId: organization.id,
      title: "Introdução à Programação",
    });

    await courseChapterFixture({
      chapterId: chapter.id,
      courseId: course.id,
      position: 0,
    });

    const result = await searchCourseChapters({
      courseSlug: course.slug,
      headers,
      language: course.language,
      orgSlug: organization.slug,
      title: "programacao",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBe(1);
    expect(result.data[0]?.id).toBe(chapter.id);
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

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toEqual([]);
  });

  test("includes position in results", async () => {
    const chapter = await chapterFixture({
      organizationId: organization.id,
      title: "Unique Searchable Title",
    });

    const expectedPosition = 5;

    await courseChapterFixture({
      chapterId: chapter.id,
      courseId: course.id,
      position: expectedPosition,
    });

    const result = await searchCourseChapters({
      courseSlug: course.slug,
      headers,
      language: course.language,
      orgSlug: organization.slug,
      title: "Unique Searchable",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBe(1);
    expect(result.data[0]?.position).toBe(expectedPosition);
  });
});

describe("owners", async () => {
  const { organization, user } = await memberFixture({ role: "owner" });

  const [headers, course] = await Promise.all([
    signInAs(user.email, user.password),
    courseFixture({ organizationId: organization.id }),
  ]);

  test("searches chapters successfully", async () => {
    const chapter = await chapterFixture({
      organizationId: organization.id,
      title: "Owner Search Test",
    });

    await courseChapterFixture({
      chapterId: chapter.id,
      courseId: course.id,
      position: 0,
    });

    const result = await searchCourseChapters({
      courseSlug: course.slug,
      headers,
      language: course.language,
      orgSlug: organization.slug,
      title: "Owner Search",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBe(1);
    expect(result.data[0]?.id).toBe(chapter.id);
  });
});
