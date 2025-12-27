import { signInAs } from "@zoonk/testing/fixtures/auth";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { ErrorCode } from "@/lib/app-error";
import { getLesson } from "./get-lesson";

describe("unauthenticated users", () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;
  let lesson: Awaited<ReturnType<typeof lessonFixture>>;

  beforeAll(async () => {
    organization = await organizationFixture();
    lesson = await lessonFixture({ organizationId: organization.id });
  });

  test("returns Forbidden when getting by id", async () => {
    const result = await getLesson({
      headers: new Headers(),
      lessonId: lesson.id,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });

  test("returns Forbidden when getting by slug", async () => {
    const result = await getLesson({
      headers: new Headers(),
      lessonSlug: lesson.slug,
      orgSlug: organization.slug,
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

    const result = await getLesson({
      headers,
      lessonId: lesson.id,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("admins", () => {
  let organization: Awaited<ReturnType<typeof memberFixture>>["organization"];
  let headers: Headers;
  let lesson: Awaited<ReturnType<typeof lessonFixture>>;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    organization = fixture.organization;

    [headers, lesson] = await Promise.all([
      signInAs(fixture.user.email, fixture.user.password),
      lessonFixture({ organizationId: fixture.organization.id }),
    ]);
  });

  test("gets lesson by id successfully", async () => {
    const result = await getLesson({
      headers,
      lessonId: lesson.id,
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(lesson.id);
    expect(result.data?.title).toBe(lesson.title);
  });

  test("gets lesson by slug successfully", async () => {
    const result = await getLesson({
      headers,
      lessonSlug: lesson.slug,
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(lesson.id);
    expect(result.data?.title).toBe(lesson.title);
  });

  test("returns null when lesson not found by id", async () => {
    const result = await getLesson({
      headers,
      lessonId: 999_999,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  test("returns null when lesson not found by slug", async () => {
    const result = await getLesson({
      headers,
      lessonSlug: "non-existent-slug",
      orgSlug: organization.slug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  test("returns Forbidden for lesson in different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherLesson = await lessonFixture({ organizationId: otherOrg.id });

    const result = await getLesson({
      headers,
      lessonId: otherLesson.id,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });

  test("returns Forbidden for lesson in different organization by slug", async () => {
    const otherOrg = await organizationFixture();
    const otherLesson = await lessonFixture({ organizationId: otherOrg.id });

    const result = await getLesson({
      headers,
      lessonSlug: otherLesson.slug,
      orgSlug: otherOrg.slug,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});
