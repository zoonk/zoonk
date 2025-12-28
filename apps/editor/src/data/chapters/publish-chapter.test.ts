import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { ErrorCode } from "@/lib/app-error";
import { toggleChapterPublished } from "./publish-chapter";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    const result = await toggleChapterPublished({
      chapterId: chapter.id,
      headers: new Headers(),
      isPublished: true,
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

    const result = await toggleChapterPublished({
      chapterId: chapter.id,
      headers,
      isPublished: true,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("admins", () => {
  let organization: Awaited<ReturnType<typeof memberFixture>>["organization"];
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let headers: Headers;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    organization = fixture.organization;
    headers = await signInAs(fixture.user.email, fixture.user.password);
    course = await courseFixture({ organizationId: organization.id });
  });

  test("publishes chapter successfully", async () => {
    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: false,
      language: course.language,
      organizationId: organization.id,
    });

    const result = await toggleChapterPublished({
      chapterId: chapter.id,
      headers,
      isPublished: true,
    });

    expect(result.error).toBeNull();
    expect(result.data?.isPublished).toBe(true);
  });

  test("unpublishes chapter successfully", async () => {
    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      language: course.language,
      organizationId: organization.id,
    });

    const result = await toggleChapterPublished({
      chapterId: chapter.id,
      headers,
      isPublished: false,
    });

    expect(result.error).toBeNull();
    expect(result.data?.isPublished).toBe(false);
  });

  test("returns Chapter not found", async () => {
    const result = await toggleChapterPublished({
      chapterId: 999_999,
      headers,
      isPublished: true,
    });

    expect(result.error?.message).toBe(ErrorCode.chapterNotFound);
    expect(result.data).toBeNull();
  });

  test("returns Forbidden for chapter in different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });
    const otherChapter = await chapterFixture({
      courseId: otherCourse.id,
      language: otherCourse.language,
      organizationId: otherOrg.id,
    });

    const result = await toggleChapterPublished({
      chapterId: otherChapter.id,
      headers,
      isPublished: true,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});
