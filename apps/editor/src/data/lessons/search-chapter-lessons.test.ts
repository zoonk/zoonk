import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import {
  chapterLessonFixture,
  lessonFixture,
} from "@zoonk/testing/fixtures/lessons";
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
    const chapter = await chapterFixture({ organizationId: organization.id });

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

    const [headers, chapter] = await Promise.all([
      signInAs(user.email, user.password),
      chapterFixture({ organizationId: organization.id }),
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

    [headers, chapter] = await Promise.all([
      signInAs(fixture.user.email, fixture.user.password),
      chapterFixture({ organizationId: fixture.organization.id }),
    ]);
  });

  test("searches lessons by title", async () => {
    const [lesson1, lesson2] = await Promise.all([
      lessonFixture({
        organizationId: organization.id,
        title: "Introduction to JavaScript",
      }),
      lessonFixture({
        organizationId: organization.id,
        title: "Advanced Python",
      }),
    ]);

    await Promise.all([
      chapterLessonFixture({
        chapterId: chapter.id,
        lessonId: lesson1.id,
        position: 0,
      }),
      chapterLessonFixture({
        chapterId: chapter.id,
        lessonId: lesson2.id,
        position: 1,
      }),
    ]);

    const result = await searchChapterLessons({
      chapterSlug: chapter.slug,
      headers,
      orgSlug: organization.slug,
      title: "javascript",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBe(1);
    expect(result.data[0]?.id).toBe(lesson1.id);
  });

  test("searches with normalized title (removes accents)", async () => {
    const lesson = await lessonFixture({
      organizationId: organization.id,
      title: "Introdução à Programação",
    });

    await chapterLessonFixture({
      chapterId: chapter.id,
      lessonId: lesson.id,
      position: 0,
    });

    const result = await searchChapterLessons({
      chapterSlug: chapter.slug,
      headers,
      orgSlug: organization.slug,
      title: "programacao",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBe(1);
    expect(result.data[0]?.id).toBe(lesson.id);
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
    const otherChapter = await chapterFixture({ organizationId: otherOrg.id });

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
    const lesson = await lessonFixture({
      organizationId: organization.id,
      title: "Unique Searchable Title",
    });

    const expectedPosition = 5;

    await chapterLessonFixture({
      chapterId: chapter.id,
      lessonId: lesson.id,
      position: expectedPosition,
    });

    const result = await searchChapterLessons({
      chapterSlug: chapter.slug,
      headers,
      orgSlug: organization.slug,
      title: "Unique Searchable",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBe(1);
    expect(result.data[0]?.position).toBe(expectedPosition);
  });
});
