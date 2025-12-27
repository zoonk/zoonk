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
import { listChapterLessons } from "./list-chapter-lessons";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const chapter = await chapterFixture({ organizationId: organization.id });

    const result = await listChapterLessons({
      chapterSlug: chapter.slug,
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

    const [headers, chapter] = await Promise.all([
      signInAs(user.email, user.password),
      chapterFixture({ organizationId: organization.id }),
    ]);

    const result = await listChapterLessons({
      chapterSlug: chapter.slug,
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
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    organization = fixture.organization;

    [headers, chapter] = await Promise.all([
      signInAs(fixture.user.email, fixture.user.password),
      chapterFixture({ organizationId: fixture.organization.id }),
    ]);
  });

  test("lists lessons for a chapter ordered by position", async () => {
    const [lesson1, lesson2, lesson3] = await Promise.all([
      lessonFixture({ organizationId: organization.id }),
      lessonFixture({ organizationId: organization.id }),
      lessonFixture({ organizationId: organization.id }),
    ]);

    await Promise.all([
      chapterLessonFixture({
        chapterId: chapter.id,
        lessonId: lesson1.id,
        position: 2,
      }),
      chapterLessonFixture({
        chapterId: chapter.id,
        lessonId: lesson2.id,
        position: 0,
      }),
      chapterLessonFixture({
        chapterId: chapter.id,
        lessonId: lesson3.id,
        position: 1,
      }),
    ]);

    const result = await listChapterLessons({
      chapterSlug: chapter.slug,
      headers,
      orgSlug: organization.slug,
    });

    const expectedLessonCount = 3;

    expect(result.error).toBeNull();
    expect(result.data.length).toBe(expectedLessonCount);
    expect(result.data[0]?.id).toBe(lesson2.id);
    expect(result.data[0]?.position).toBe(0);
    expect(result.data[1]?.id).toBe(lesson3.id);
    expect(result.data[1]?.position).toBe(1);
    expect(result.data[2]?.id).toBe(lesson1.id);
    expect(result.data[2]?.position).toBe(2);
  });

  test("returns empty array when chapter has no lessons", async () => {
    const emptyChapter = await chapterFixture({
      organizationId: organization.id,
    });

    const result = await listChapterLessons({
      chapterSlug: emptyChapter.slug,
      headers,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  test("returns empty array when chapter not found", async () => {
    const result = await listChapterLessons({
      chapterSlug: "non-existent-chapter",
      headers,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  test("returns Forbidden for chapter in different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherChapter = await chapterFixture({ organizationId: otherOrg.id });

    const result = await listChapterLessons({
      chapterSlug: otherChapter.slug,
      headers,
      orgSlug: otherOrg.slug,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toEqual([]);
  });
});
