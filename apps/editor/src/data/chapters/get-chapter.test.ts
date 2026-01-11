import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { ErrorCode } from "@/lib/app-error";
import { getChapter } from "./get-chapter";

describe("unauthenticated users", () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });
    chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });
  });

  test("returns Forbidden", async () => {
    const result = await getChapter({
      chapterSlug: chapter.slug,
      headers: new Headers(),
      language: chapter.language,
      orgSlug: organization.slug,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
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

    const result = await getChapter({
      chapterSlug: chapter.slug,
      headers,
      language: chapter.language,
      orgSlug: organization.slug,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("admins", () => {
  let organization: Awaited<ReturnType<typeof memberFixture>>["organization"];
  let headers: Headers;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    organization = fixture.organization;

    course = await courseFixture({
      language: "en",
      organizationId: organization.id,
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

  test("gets chapter by slug successfully", async () => {
    const result = await getChapter({
      chapterSlug: chapter.slug,
      headers,
      language: chapter.language,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(chapter.id);
    expect(result.data?.title).toBe(chapter.title);
  });

  test("returns null when chapter not found", async () => {
    const result = await getChapter({
      chapterSlug: "non-existent-slug",
      headers,
      language: chapter.language,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  test("returns null when language doesn't match", async () => {
    const result = await getChapter({
      chapterSlug: chapter.slug,
      headers,
      language: "xx",
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  test("returns the chapter with the correct language", async () => {
    const ptCourse = await courseFixture({
      language: "pt",
      organizationId: organization.id,
    });
    const ptChapter = await chapterFixture({
      courseId: ptCourse.id,
      language: "pt",
      organizationId: organization.id,
      slug: chapter.slug,
    });

    const result = await getChapter({
      chapterSlug: chapter.slug,
      headers,
      language: "pt",
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(ptChapter.id);
    expect(result.data?.language).toBe("pt");
  });

  test("returns Forbidden for chapter in different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });
    const otherChapter = await chapterFixture({
      courseId: otherCourse.id,
      language: otherCourse.language,
      organizationId: otherOrg.id,
    });

    const result = await getChapter({
      chapterSlug: otherChapter.slug,
      headers,
      language: otherChapter.language,
      orgSlug: otherOrg.slug,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});
