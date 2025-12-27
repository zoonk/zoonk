import { prisma } from "@zoonk/db";
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
import { deleteLesson } from "./delete-lesson";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const lesson = await lessonFixture({ organizationId: organization.id });

    const result = await deleteLesson({
      headers: new Headers(),
      lessonId: lesson.id,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();

    const unchangedLesson = await prisma.lesson.findUnique({
      where: { id: lesson.id },
    });

    expect(unchangedLesson).not.toBeNull();
  });
});

describe("members", () => {
  test("returns Forbidden", async () => {
    const { organization, user } = await memberFixture({ role: "member" });
    const headers = await signInAs(user.email, user.password);
    const lesson = await lessonFixture({ organizationId: organization.id });

    const result = await deleteLesson({
      headers,
      lessonId: lesson.id,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();

    const unchangedLesson = await prisma.lesson.findUnique({
      where: { id: lesson.id },
    });

    expect(unchangedLesson).not.toBeNull();
  });
});

describe("admins", () => {
  test("returns Forbidden", async () => {
    const { organization, user } = await memberFixture({ role: "admin" });
    const headers = await signInAs(user.email, user.password);
    const lesson = await lessonFixture({ organizationId: organization.id });

    const result = await deleteLesson({
      headers,
      lessonId: lesson.id,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();

    const unchangedLesson = await prisma.lesson.findUnique({
      where: { id: lesson.id },
    });

    expect(unchangedLesson).not.toBeNull();
  });
});

describe("owners", () => {
  let organization: Awaited<ReturnType<typeof memberFixture>>["organization"];
  let headers: Headers;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "owner" });
    organization = fixture.organization;
    headers = await signInAs(fixture.user.email, fixture.user.password);
  });

  test("returns Lesson not found", async () => {
    const result = await deleteLesson({
      headers,
      lessonId: 999_999,
    });

    expect(result.error?.message).toBe(ErrorCode.lessonNotFound);
    expect(result.data).toBeNull();
  });

  test("deletes lesson successfully", async () => {
    const lesson = await lessonFixture({ organizationId: organization.id });

    const result = await deleteLesson({
      headers,
      lessonId: lesson.id,
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(lesson.id);

    const deletedLesson = await prisma.lesson.findUnique({
      where: { id: lesson.id },
    });

    expect(deletedLesson).toBeNull();
  });

  test("cascades deletion to chapter lessons", async () => {
    const [chapter, lesson] = await Promise.all([
      chapterFixture({ organizationId: organization.id }),
      lessonFixture({ organizationId: organization.id }),
    ]);

    const chapterLesson = await chapterLessonFixture({
      chapterId: chapter.id,
      lessonId: lesson.id,
      position: 0,
    });

    const result = await deleteLesson({
      headers,
      lessonId: lesson.id,
    });

    expect(result.error).toBeNull();

    const deletedChapterLesson = await prisma.chapterLesson.findUnique({
      where: { id: chapterLesson.id },
    });

    expect(deletedChapterLesson).toBeNull();
  });

  test("returns Forbidden for lesson in different organization", async () => {
    const otherOrg = await organizationFixture();

    const lessonInOtherOrg = await lessonFixture({
      organizationId: otherOrg.id,
    });

    const result = await deleteLesson({
      headers,
      lessonId: lessonInOtherOrg.id,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();

    const unchangedLesson = await prisma.lesson.findUnique({
      where: { id: lessonInOtherOrg.id },
    });

    expect(unchangedLesson).not.toBeNull();
  });
});
