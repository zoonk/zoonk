import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { ErrorCode } from "@/lib/app-error";
import { searchOrgLessons } from "./search-org-lessons";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();

    const result = await searchOrgLessons({
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

    const result = await searchOrgLessons({
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

  test("searches all lessons in organization by title", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        language: chapter.language,
        organizationId: organization.id,
        position: 0,
        title: "Learn JavaScript Basics",
      }),
      lessonFixture({
        chapterId: chapter.id,
        language: chapter.language,
        organizationId: organization.id,
        position: 1,
        title: "Advanced Python Techniques",
      }),
      lessonFixture({
        chapterId: chapter.id,
        language: chapter.language,
        organizationId: organization.id,
        position: 2,
        title: "JavaScript Functions",
      }),
    ]);

    const result = await searchOrgLessons({
      headers,
      orgSlug: organization.slug,
      title: "javascript",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBe(2);
  });

  test("searches with normalized title (removes accents)", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    await lessonFixture({
      chapterId: chapter.id,
      language: chapter.language,
      organizationId: organization.id,
      position: 0,
      title: "Introdução à Programação",
    });

    const result = await searchOrgLessons({
      headers,
      orgSlug: organization.slug,
      title: "programacao",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(
      result.data.some((l) => l.title === "Introdução à Programação"),
    ).toBe(true);
  });

  test("returns empty array when no matches", async () => {
    const result = await searchOrgLessons({
      headers,
      orgSlug: organization.slug,
      title: "xyznonexistent123",
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  test("returns Forbidden for lesson in different organization", async () => {
    const otherOrg = await organizationFixture();

    const result = await searchOrgLessons({
      headers,
      orgSlug: otherOrg.slug,
      title: "test",
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toEqual([]);
  });

  test("case insensitive search", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    await lessonFixture({
      chapterId: chapter.id,
      language: chapter.language,
      organizationId: organization.id,
      position: 0,
      title: "UPPERCASE TITLE",
    });

    const result = await searchOrgLessons({
      headers,
      orgSlug: organization.slug,
      title: "uppercase",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(result.data.some((l) => l.title === "UPPERCASE TITLE")).toBe(true);
  });

  test("partial match search", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    await lessonFixture({
      chapterId: chapter.id,
      language: chapter.language,
      organizationId: organization.id,
      position: 0,
      title: "Very Long Lesson Title For Testing",
    });

    const result = await searchOrgLessons({
      headers,
      orgSlug: organization.slug,
      title: "Long Lesson",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(
      result.data.some((l) => l.title === "Very Long Lesson Title For Testing"),
    ).toBe(true);
  });

  test("includes chapter info in results", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    await lessonFixture({
      chapterId: chapter.id,
      language: chapter.language,
      organizationId: organization.id,
      position: 0,
      title: "Lesson With Chapter Info",
    });

    const result = await searchOrgLessons({
      headers,
      orgSlug: organization.slug,
      title: "Lesson With Chapter",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBeGreaterThanOrEqual(1);

    const lesson = result.data.find(
      (l) => l.title === "Lesson With Chapter Info",
    );

    expect(lesson?.chapter).toBeDefined();
    expect(lesson?.chapter.slug).toBe(chapter.slug);
    expect(lesson?.chapter.course.slug).toBe(course.slug);
    expect(lesson?.chapter.course.language).toBe(course.language);
  });
});
