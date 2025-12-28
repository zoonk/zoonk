import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { ErrorCode } from "@/lib/app-error";
import { deleteChapter } from "./delete-chapter";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    const result = await deleteChapter({
      chapterId: chapter.id,
      headers: new Headers(),
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();

    const unchangedChapter = await prisma.chapter.findUnique({
      where: { id: chapter.id },
    });

    expect(unchangedChapter).not.toBeNull();
  });
});

describe("members", () => {
  test("returns Forbidden", async () => {
    const { organization, user } = await memberFixture({ role: "member" });
    const course = await courseFixture({ organizationId: organization.id });
    const headers = await signInAs(user.email, user.password);
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    const result = await deleteChapter({
      chapterId: chapter.id,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();

    const unchangedChapter = await prisma.chapter.findUnique({
      where: { id: chapter.id },
    });

    expect(unchangedChapter).not.toBeNull();
  });
});

describe("admins", () => {
  test("returns Forbidden", async () => {
    const { organization, user } = await memberFixture({ role: "admin" });
    const course = await courseFixture({ organizationId: organization.id });
    const headers = await signInAs(user.email, user.password);
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    const result = await deleteChapter({
      chapterId: chapter.id,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();

    const unchangedChapter = await prisma.chapter.findUnique({
      where: { id: chapter.id },
    });

    expect(unchangedChapter).not.toBeNull();
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

  test("returns Chapter not found", async () => {
    const result = await deleteChapter({
      chapterId: 999_999,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.chapterNotFound);
    expect(result.data).toBeNull();
  });

  test("deletes chapter successfully", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    const result = await deleteChapter({
      chapterId: chapter.id,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(chapter.id);

    const deletedChapter = await prisma.chapter.findUnique({
      where: { id: chapter.id },
    });

    expect(deletedChapter).toBeNull();
  });

  test("cascades deletion to lessons", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      language: chapter.language,
      organizationId: organization.id,
    });

    const result = await deleteChapter({
      chapterId: chapter.id,
      headers,
    });

    expect(result.error).toBeNull();

    const deletedLesson = await prisma.lesson.findUnique({
      where: { id: lesson.id },
    });

    expect(deletedLesson).toBeNull();
  });

  test("returns Forbidden for chapter in different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });

    const chapterInOtherOrg = await chapterFixture({
      courseId: otherCourse.id,
      language: otherCourse.language,
      organizationId: otherOrg.id,
    });

    const result = await deleteChapter({
      chapterId: chapterInOtherOrg.id,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();

    const unchangedChapter = await prisma.chapter.findUnique({
      where: { id: chapterInOtherOrg.id },
    });

    expect(unchangedChapter).not.toBeNull();
  });
});
