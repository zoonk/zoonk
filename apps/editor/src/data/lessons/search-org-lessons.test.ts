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
    await Promise.all([
      lessonFixture({
        organizationId: organization.id,
        title: "Learn JavaScript Basics",
      }),
      lessonFixture({
        organizationId: organization.id,
        title: "Advanced Python Techniques",
      }),
      lessonFixture({
        organizationId: organization.id,
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
    await lessonFixture({
      organizationId: organization.id,
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
      title: "xyznonexistentxyz",
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  test("only returns lessons from the specified organization", async () => {
    const otherOrg = await organizationFixture();

    await Promise.all([
      lessonFixture({
        organizationId: otherOrg.id,
        title: "Other Org Unique Lesson",
      }),
      lessonFixture({
        organizationId: organization.id,
        title: "My Org Unique Lesson",
      }),
    ]);

    const result = await searchOrgLessons({
      headers,
      orgSlug: organization.slug,
      title: "Unique Lesson",
    });

    expect(result.error).toBeNull();
    expect(result.data.length).toBe(1);
    expect(result.data[0]?.title).toBe("My Org Unique Lesson");
  });

  test("returns Forbidden for different organization", async () => {
    const otherOrg = await organizationFixture();

    const result = await searchOrgLessons({
      headers,
      orgSlug: otherOrg.slug,
      title: "test",
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toEqual([]);
  });

  test("returns chapters array with slug for linked lessons", async () => {
    const lesson = await lessonFixture({
      organizationId: organization.id,
      title: "Lesson With Chapters Linked",
    });

    const [chapter1, chapter2] = await Promise.all([
      chapterFixture({
        organizationId: organization.id,
        slug: "chapter-one",
      }),
      chapterFixture({
        organizationId: organization.id,
        slug: "chapter-two",
      }),
    ]);

    await Promise.all([
      chapterLessonFixture({
        chapterId: chapter1.id,
        lessonId: lesson.id,
        position: 0,
      }),
      chapterLessonFixture({
        chapterId: chapter2.id,
        lessonId: lesson.id,
        position: 0,
      }),
    ]);

    const result = await searchOrgLessons({
      headers,
      orgSlug: organization.slug,
      title: "Lesson With Chapters Linked",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.chapters).toHaveLength(2);

    const chapterSlugs = result.data[0]?.chapters.map((c) => c.slug);

    expect(chapterSlugs).toContain("chapter-one");
    expect(chapterSlugs).toContain("chapter-two");
  });

  test("returns empty chapters array for lessons not linked to any chapter", async () => {
    await lessonFixture({
      organizationId: organization.id,
      title: "Standalone Lesson No Chapter",
    });

    const result = await searchOrgLessons({
      headers,
      orgSlug: organization.slug,
      title: "Standalone Lesson No Chapter",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.chapters).toEqual([]);
  });

  test("returns lesson linked to single chapter", async () => {
    const lesson = await lessonFixture({
      organizationId: organization.id,
      title: "Single Chapter Lesson Link",
    });

    const chapter = await chapterFixture({
      organizationId: organization.id,
      slug: "single-chapter-link",
    });

    await chapterLessonFixture({
      chapterId: chapter.id,
      lessonId: lesson.id,
      position: 0,
    });

    const result = await searchOrgLessons({
      headers,
      orgSlug: organization.slug,
      title: "Single Chapter Lesson Link",
    });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.chapters).toHaveLength(1);
    expect(result.data[0]?.chapters[0]?.slug).toBe("single-chapter-link");
  });
});
