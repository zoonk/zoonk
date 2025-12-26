import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { describe, expect, test } from "vitest";
import { toggleChapterPublished } from "./publish-chapter";

describe("unauthenticated users", async () => {
  const organization = await organizationFixture();
  const chapter = await chapterFixture({ organizationId: organization.id });

  test("returns Forbidden", async () => {
    const result = await toggleChapterPublished({
      chapterId: chapter.id,
      headers: new Headers(),
      isPublished: true,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });
});

describe("members", async () => {
  const { organization, user } = await memberFixture({ role: "member" });
  const headers = await signInAs(user.email, user.password);
  const chapter = await chapterFixture({ organizationId: organization.id });

  test("returns Forbidden", async () => {
    const result = await toggleChapterPublished({
      chapterId: chapter.id,
      headers,
      isPublished: true,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });
});

describe("admins", async () => {
  const { organization, user } = await memberFixture({ role: "admin" });
  const headers = await signInAs(user.email, user.password);

  test("publishes chapter successfully", async () => {
    const chapter = await chapterFixture({
      isPublished: false,
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
      isPublished: true,
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

    expect(result.error?.message).toBe("Chapter not found");
    expect(result.data).toBeNull();
  });

  test("returns Forbidden for chapter in different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherChapter = await chapterFixture({ organizationId: otherOrg.id });

    const result = await toggleChapterPublished({
      chapterId: otherChapter.id,
      headers,
      isPublished: true,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });
});

describe("owners", async () => {
  const { organization, user } = await memberFixture({ role: "owner" });
  const headers = await signInAs(user.email, user.password);

  test("publishes chapter successfully", async () => {
    const chapter = await chapterFixture({
      isPublished: false,
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
});
