import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { ErrorCode } from "@/lib/app-error";
import { updateChapter } from "./update-chapter";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    const result = await updateChapter({
      chapterId: chapter.id,
      headers: new Headers(),
      title: "Updated Title",
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

    const result = await updateChapter({
      chapterId: chapter.id,
      headers,
      title: "Updated Title",
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("admins", () => {
  let _organization: Awaited<ReturnType<typeof memberFixture>>["organization"];
  let headers: Headers;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    _organization = fixture.organization;

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

  test("updates title successfully", async () => {
    const result = await updateChapter({
      chapterId: chapter.id,
      headers,
      title: "Updated Title",
    });

    expect(result.error).toBeNull();
    expect(result.data?.title).toBe("Updated Title");
  });

  test("updates description successfully", async () => {
    const result = await updateChapter({
      chapterId: chapter.id,
      description: "Updated description",
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data?.description).toBe("Updated description");
  });

  test("updates slug successfully", async () => {
    const result = await updateChapter({
      chapterId: chapter.id,
      headers,
      slug: "new-slug",
    });

    expect(result.error).toBeNull();
    expect(result.data?.slug).toBe("new-slug");
  });

  test("normalizes slug", async () => {
    const result = await updateChapter({
      chapterId: chapter.id,
      headers,
      slug: "My Updated Chapter!",
    });

    expect(result.error).toBeNull();
    expect(result.data?.slug).toBe("my-updated-chapter");
  });

  test("normalizes title for search", async () => {
    const result = await updateChapter({
      chapterId: chapter.id,
      headers,
      title: "Ciência da Computação",
    });

    expect(result.error).toBeNull();
    expect(result.data?.normalizedTitle).toBe("ciencia da computacao");
  });

  test("updates multiple fields at once", async () => {
    const result = await updateChapter({
      chapterId: chapter.id,
      description: "New description",
      headers,
      slug: "new-slug-multi",
      title: "New Title",
    });

    expect(result.error).toBeNull();
    expect(result.data?.title).toBe("New Title");
    expect(result.data?.description).toBe("New description");
    expect(result.data?.slug).toBe("new-slug-multi");
  });

  test("returns Chapter not found", async () => {
    const result = await updateChapter({
      chapterId: 999_999,
      headers,
      title: "Updated Title",
    });

    expect(result.error?.message).toBe(ErrorCode.chapterNotFound);
    expect(result.data).toBeNull();
  });

  test("don't allow to update chapter for a different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });
    const otherChapter = await chapterFixture({
      courseId: otherCourse.id,
      language: otherCourse.language,
      organizationId: otherOrg.id,
    });

    const result = await updateChapter({
      chapterId: otherChapter.id,
      headers,
      title: "Updated Title",
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});
