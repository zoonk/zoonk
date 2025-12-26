import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { describe, expect, test } from "vitest";
import { updateChapter } from "./update-chapter";

describe("unauthenticated users", async () => {
  const organization = await organizationFixture();
  const chapter = await chapterFixture({ organizationId: organization.id });

  test("returns Forbidden", async () => {
    const result = await updateChapter({
      chapterId: chapter.id,
      headers: new Headers(),
      title: "Updated Title",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });
});

describe("members", async () => {
  const { organization, user } = await memberFixture({ role: "member" });

  const [headers, chapter] = await Promise.all([
    signInAs(user.email, user.password),
    chapterFixture({ organizationId: organization.id }),
  ]);

  test("returns Forbidden", async () => {
    const result = await updateChapter({
      chapterId: chapter.id,
      headers,
      title: "Updated Title",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });
});

describe("admins", async () => {
  const { organization, user } = await memberFixture({ role: "admin" });

  const [headers, chapter] = await Promise.all([
    signInAs(user.email, user.password),
    chapterFixture({ organizationId: organization.id }),
  ]);

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

    expect(result.error?.message).toBe("Chapter not found");
    expect(result.data).toBeNull();
  });

  test("don't allow to update chapter for a different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherChapter = await chapterFixture({ organizationId: otherOrg.id });

    const result = await updateChapter({
      chapterId: otherChapter.id,
      headers,
      title: "Updated Title",
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });
});
