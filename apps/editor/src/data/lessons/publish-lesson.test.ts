import { signInAs } from "@zoonk/testing/fixtures/auth";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { ErrorCode } from "@/lib/app-error";
import { toggleLessonPublished } from "./publish-lesson";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const lesson = await lessonFixture({ organizationId: organization.id });

    const result = await toggleLessonPublished({
      headers: new Headers(),
      isPublished: true,
      lessonId: lesson.id,
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

    const result = await toggleLessonPublished({
      headers,
      isPublished: true,
      lessonId: lesson.id,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
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

  test("publishes lesson successfully", async () => {
    const lesson = await lessonFixture({
      isPublished: false,
      organizationId: organization.id,
    });

    const result = await toggleLessonPublished({
      headers,
      isPublished: true,
      lessonId: lesson.id,
    });

    expect(result.error).toBeNull();
    expect(result.data?.isPublished).toBe(true);
  });

  test("unpublishes lesson successfully", async () => {
    const lesson = await lessonFixture({
      isPublished: true,
      organizationId: organization.id,
    });

    const result = await toggleLessonPublished({
      headers,
      isPublished: false,
      lessonId: lesson.id,
    });

    expect(result.error).toBeNull();
    expect(result.data?.isPublished).toBe(false);
  });

  test("returns Lesson not found", async () => {
    const result = await toggleLessonPublished({
      headers,
      isPublished: true,
      lessonId: 999_999,
    });

    expect(result.error?.message).toBe(ErrorCode.lessonNotFound);
    expect(result.data).toBeNull();
  });

  test("returns Forbidden for lesson in different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherLesson = await lessonFixture({ organizationId: otherOrg.id });

    const result = await toggleLessonPublished({
      headers,
      isPublished: true,
      lessonId: otherLesson.id,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});
