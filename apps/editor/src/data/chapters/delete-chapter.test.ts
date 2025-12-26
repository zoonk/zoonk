import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import {
  chapterFixture,
  courseChapterFixture,
} from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { deleteChapter } from "./delete-chapter";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const chapter = await chapterFixture({ organizationId: organization.id });

    const result = await deleteChapter({
      chapterId: chapter.id,
      headers: new Headers(),
    });

    expect(result.error?.message).toBe("Forbidden");
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
    const headers = await signInAs(user.email, user.password);
    const chapter = await chapterFixture({ organizationId: organization.id });

    const result = await deleteChapter({
      chapterId: chapter.id,
      headers,
    });

    expect(result.error?.message).toBe("Forbidden");
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
    const headers = await signInAs(user.email, user.password);
    const chapter = await chapterFixture({ organizationId: organization.id });

    const result = await deleteChapter({
      chapterId: chapter.id,
      headers,
    });

    expect(result.error?.message).toBe("Forbidden");
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

    expect(result.error?.message).toBe("Chapter not found");
    expect(result.data).toBeNull();
  });

  test("deletes chapter successfully", async () => {
    const chapter = await chapterFixture({ organizationId: organization.id });

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

  test("cascades deletion to course chapters", async () => {
    const [course, chapter] = await Promise.all([
      courseFixture({ organizationId: organization.id }),
      chapterFixture({ organizationId: organization.id }),
    ]);

    const courseChapter = await courseChapterFixture({
      chapterId: chapter.id,
      courseId: course.id,
      position: 0,
    });

    const result = await deleteChapter({
      chapterId: chapter.id,
      headers,
    });

    expect(result.error).toBeNull();

    const deletedCourseChapter = await prisma.courseChapter.findUnique({
      where: { id: courseChapter.id },
    });

    expect(deletedCourseChapter).toBeNull();
  });

  test("returns Forbidden for chapter in different organization", async () => {
    const otherOrg = await organizationFixture();

    const chapterInOtherOrg = await chapterFixture({
      organizationId: otherOrg.id,
    });

    const result = await deleteChapter({
      chapterId: chapterInOtherOrg.id,
      headers,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();

    const unchangedChapter = await prisma.chapter.findUnique({
      where: { id: chapterInOtherOrg.id },
    });

    expect(unchangedChapter).not.toBeNull();
  });
});
