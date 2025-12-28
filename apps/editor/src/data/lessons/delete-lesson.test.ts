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
import { deleteLesson } from "./delete-lesson";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
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
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });
    const headers = await signInAs(user.email, user.password);
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      language: chapter.language,
      organizationId: organization.id,
    });

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
    const course = await courseFixture({ organizationId: organization.id });
    const chapter = await chapterFixture({
      courseId: course.id,
      language: course.language,
      organizationId: organization.id,
    });
    const headers = await signInAs(user.email, user.password);
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      language: chapter.language,
      organizationId: organization.id,
    });

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

  test("returns Forbidden for lesson in different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });
    const otherChapter = await chapterFixture({
      courseId: otherCourse.id,
      language: otherCourse.language,
      organizationId: otherOrg.id,
    });

    const lessonInOtherOrg = await lessonFixture({
      chapterId: otherChapter.id,
      language: otherChapter.language,
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
