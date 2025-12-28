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
import { searchChapterLessons } from "./search-chapter-lessons";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    const result = await searchChapterLessons({
      chapterSlug: chapter.slug,
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
    const course = await courseFixture({ organizationId: organization.id });

    const [headers, chapter] = await Promise.all([
      signInAs(user.email, user.password),
      chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: organization.id,
      }),
    ]);

    const result = await searchChapterLessons({
      chapterSlug: chapter.slug,
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
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    organization = fixture.organization;
    const course = await courseFixture({
      organizationId: fixture.organization.id,
    });

    [headers, chapter] = await Promise.all([
      signInAs(fixture.user.email, fixture.user.password),
      chapterFixture({
        courseId: course.id,
        language: course.language,
        organizationId: fixture.organization.id,
      }),
    ]);
  });

  test("searches lessons by title", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const newChapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    await Promise.all([
      lessonFixture({
        chapterId: newChapter.id,
        language: newChapter.language,
        organizationId: organization.id,
        position: 0,
        title: "Introduction to JavaScript",
      }),
      lessonFixture({
        chapterId: newChapter.id,
        language: newChapter.language,
        organizationId: organization.id,
        position: 1,
        title: "Advanced Python",
      }),
    ]);

    const result = await searchChapterLessons({
      chapterSlug: newChapter.slug,
      headers,
      orgSlug: organization.slug,
      title: "javascript",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBe(1);
    expect(result.data[0]?.title).toBe("Introduction to JavaScript");
  });

  test("searches with normalized title (removes accents)", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const newChapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    await lessonFixture({
      chapterId: newChapter.id,
      language: newChapter.language,
      organizationId: organization.id,
      position: 0,
      title: "Introdução à Programação",
    });

    const result = await searchChapterLessons({
      chapterSlug: newChapter.slug,
      headers,
      orgSlug: organization.slug,
      title: "programacao",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBe(1);
    expect(result.data[0]?.title).toBe("Introdução à Programação");
  });

  test("returns empty array when no matches", async () => {
    const result = await searchChapterLessons({
      chapterSlug: chapter.slug,
      headers,
      orgSlug: organization.slug,
      title: "nonexistent",
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  test("returns Forbidden for chapter in different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });
    const otherChapter = await chapterFixture({
      courseId: otherCourse.id,
      language: otherCourse.language,
      organizationId: otherOrg.id,
    });

    const result = await searchChapterLessons({
      chapterSlug: otherChapter.slug,
      headers,
      orgSlug: otherOrg.slug,
      title: "test",
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toEqual([]);
  });

  test("includes position in results", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const newChapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });
    const expectedPosition = 5;

    await lessonFixture({
      chapterId: newChapter.id,
      language: newChapter.language,
      organizationId: organization.id,
      position: expectedPosition,
      title: "Unique Searchable Title",
    });

    const result = await searchChapterLessons({
      chapterSlug: newChapter.slug,
      headers,
      orgSlug: organization.slug,
      title: "Unique Searchable",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBe(1);
    expect(result.data[0]?.position).toBe(expectedPosition);
  });
});
