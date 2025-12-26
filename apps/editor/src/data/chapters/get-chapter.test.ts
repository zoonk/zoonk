import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { describe, expect, test } from "vitest";
import { getChapter } from "./get-chapter";

describe("unauthenticated users", async () => {
  const organization = await organizationFixture();
  const chapter = await chapterFixture({ organizationId: organization.id });

  test("returns Forbidden when getting by id", async () => {
    const result = await getChapter({
      chapterId: chapter.id,
      headers: new Headers(),
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });

  test("returns Forbidden when getting by slug", async () => {
    const result = await getChapter({
      chapterSlug: chapter.slug,
      headers: new Headers(),
      orgSlug: organization.slug,
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
    const result = await getChapter({
      chapterId: chapter.id,
      headers,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });
});

describe("admins", async () => {
  const { organization, user } = await memberFixture({ role: "admin" });
  const headers = await signInAs(user.email, user.password);
  const chapter = await chapterFixture({ organizationId: organization.id });

  test("gets chapter by id successfully", async () => {
    const result = await getChapter({
      chapterId: chapter.id,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(chapter.id);
    expect(result.data?.title).toBe(chapter.title);
  });

  test("gets chapter by slug successfully", async () => {
    const result = await getChapter({
      chapterSlug: chapter.slug,
      headers,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(chapter.id);
    expect(result.data?.title).toBe(chapter.title);
  });

  test("returns null when chapter not found by id", async () => {
    const result = await getChapter({
      chapterId: 999_999,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  test("returns null when chapter not found by slug", async () => {
    const result = await getChapter({
      chapterSlug: "non-existent-slug",
      headers,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  test("returns Forbidden for chapter in different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherChapter = await chapterFixture({ organizationId: otherOrg.id });

    const result = await getChapter({
      chapterId: otherChapter.id,
      headers,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });
});

describe("owners", async () => {
  const { organization, user } = await memberFixture({ role: "owner" });
  const headers = await signInAs(user.email, user.password);
  const chapter = await chapterFixture({ organizationId: organization.id });

  test("gets chapter successfully", async () => {
    const result = await getChapter({
      chapterId: chapter.id,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(chapter.id);
  });
});
