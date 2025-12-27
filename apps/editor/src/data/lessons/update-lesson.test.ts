import { signInAs } from "@zoonk/testing/fixtures/auth";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { ErrorCode } from "@/lib/app-error";
import { updateLesson } from "./update-lesson";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const lesson = await lessonFixture({ organizationId: organization.id });

    const result = await updateLesson({
      headers: new Headers(),
      lessonId: lesson.id,
      title: "Updated Title",
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("members", () => {
  test("returns Forbidden", async () => {
    const { organization, user } = await memberFixture({ role: "member" });

    const [headers, lesson] = await Promise.all([
      signInAs(user.email, user.password),
      lessonFixture({ organizationId: organization.id }),
    ]);

    const result = await updateLesson({
      headers,
      lessonId: lesson.id,
      title: "Updated Title",
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("admins", () => {
  let _organization: Awaited<ReturnType<typeof memberFixture>>["organization"];
  let headers: Headers;
  let lesson: Awaited<ReturnType<typeof lessonFixture>>;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    _organization = fixture.organization;

    [headers, lesson] = await Promise.all([
      signInAs(fixture.user.email, fixture.user.password),
      lessonFixture({ organizationId: fixture.organization.id }),
    ]);
  });

  test("updates title successfully", async () => {
    const result = await updateLesson({
      headers,
      lessonId: lesson.id,
      title: "Updated Title",
    });

    expect(result.error).toBeNull();
    expect(result.data?.title).toBe("Updated Title");
  });

  test("updates description successfully", async () => {
    const result = await updateLesson({
      description: "Updated description",
      headers,
      lessonId: lesson.id,
    });

    expect(result.error).toBeNull();
    expect(result.data?.description).toBe("Updated description");
  });

  test("updates slug successfully", async () => {
    const result = await updateLesson({
      headers,
      lessonId: lesson.id,
      slug: "new-slug",
    });

    expect(result.error).toBeNull();
    expect(result.data?.slug).toBe("new-slug");
  });

  test("normalizes slug", async () => {
    const result = await updateLesson({
      headers,
      lessonId: lesson.id,
      slug: "My Updated Lesson!",
    });

    expect(result.error).toBeNull();
    expect(result.data?.slug).toBe("my-updated-lesson");
  });

  test("normalizes title for search", async () => {
    const result = await updateLesson({
      headers,
      lessonId: lesson.id,
      title: "Introdução à Programação",
    });

    expect(result.error).toBeNull();
    expect(result.data?.normalizedTitle).toBe("introducao a programacao");
  });

  test("updates multiple fields at once", async () => {
    const result = await updateLesson({
      description: "New description",
      headers,
      lessonId: lesson.id,
      slug: "new-slug-multi",
      title: "New Title",
    });

    expect(result.error).toBeNull();
    expect(result.data?.title).toBe("New Title");
    expect(result.data?.description).toBe("New description");
    expect(result.data?.slug).toBe("new-slug-multi");
  });

  test("returns Lesson not found", async () => {
    const result = await updateLesson({
      headers,
      lessonId: 999_999,
      title: "Updated Title",
    });

    expect(result.error?.message).toBe(ErrorCode.lessonNotFound);
    expect(result.data).toBeNull();
  });

  test("don't allow to update lesson for a different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherLesson = await lessonFixture({ organizationId: otherOrg.id });

    const result = await updateLesson({
      headers,
      lessonId: otherLesson.id,
      title: "Updated Title",
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});
