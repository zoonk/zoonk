import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterAttrs } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  memberFixture,
  organizationFixture,
} from "@zoonk/testing/fixtures/orgs";
import { describe, expect, test } from "vitest";
import { createChapter } from "./create-chapter";

describe("unauthenticated users", async () => {
  const organization = await organizationFixture();
  const course = await courseFixture({ organizationId: organization.id });

  test("returns Forbidden", async () => {
    const result = await createChapter({
      ...chapterAttrs(),
      courseId: course.id,
      headers: new Headers(),
      position: 0,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });
});

describe("members", async () => {
  const { organization, user } = await memberFixture({ role: "member" });
  const headers = await signInAs(user.email, user.password);
  const course = await courseFixture({ organizationId: organization.id });

  test("returns Forbidden", async () => {
    const result = await createChapter({
      ...chapterAttrs(),
      courseId: course.id,
      headers,
      position: 0,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });
});

describe("admins", async () => {
  const { organization, user } = await memberFixture({ role: "admin" });
  const headers = await signInAs(user.email, user.password);
  const course = await courseFixture({ organizationId: organization.id });

  test("creates chapter successfully", async () => {
    const attrs = chapterAttrs();

    const result = await createChapter({
      ...attrs,
      courseId: course.id,
      headers,
      position: 0,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
    expect(result.data?.chapter.title).toBe(attrs.title);
    expect(result.data?.chapter.description).toBe(attrs.description);
    expect(result.data?.chapter.organizationId).toBe(organization.id);
    expect(result.data?.courseChapterId).toBeDefined();
  });

  test("normalizes slug", async () => {
    const attrs = chapterAttrs();

    const result = await createChapter({
      ...attrs,
      courseId: course.id,
      headers,
      position: 0,
      slug: "My Test Chapter!",
    });

    expect(result.error).toBeNull();
    expect(result.data?.chapter.slug).toBe("my-test-chapter");
  });

  test("normalizes title for search", async () => {
    const attrs = chapterAttrs();

    const result = await createChapter({
      ...attrs,
      courseId: course.id,
      headers,
      position: 0,
      title: "Ciência da Computação",
    });

    expect(result.error).toBeNull();
    expect(result.data?.chapter.normalizedTitle).toBe("ciencia da computacao");
  });

  test("returns Course not found", async () => {
    const result = await createChapter({
      ...chapterAttrs(),
      courseId: 999_999,
      headers,
      position: 0,
    });

    expect(result.error?.message).toBe("Course not found");
    expect(result.data).toBeNull();
  });

  test("don't allow to create chapter for a different organization", async () => {
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });

    const result = await createChapter({
      ...chapterAttrs(),
      courseId: otherCourse.id,
      headers,
      position: 0,
    });

    expect(result.error?.message).toBe("Forbidden");
    expect(result.data).toBeNull();
  });

  test("returns error when slug already exists for same org", async () => {
    const attrs = chapterAttrs();

    await createChapter({
      ...attrs,
      courseId: course.id,
      headers,
      position: 0,
    });

    const result = await createChapter({
      ...attrs,
      courseId: course.id,
      headers,
      position: 1,
    });

    expect(result.error).not.toBeNull();
  });

  test("creates chapter at correct position", async () => {
    const attrs = chapterAttrs();
    const expectedPosition = 5;

    const result = await createChapter({
      ...attrs,
      courseId: course.id,
      headers,
      position: expectedPosition,
    });

    expect(result.error).toBeNull();

    const courseChapter = await prisma.courseChapter.findUnique({
      where: { id: result.data?.courseChapterId },
    });

    expect(courseChapter?.position).toBe(expectedPosition);
  });
});

describe("owners", async () => {
  const { organization, user } = await memberFixture({ role: "owner" });
  const headers = await signInAs(user.email, user.password);
  const course = await courseFixture({ organizationId: organization.id });

  test("creates chapter successfully", async () => {
    const attrs = chapterAttrs();

    const result = await createChapter({
      ...attrs,
      courseId: course.id,
      headers,
      position: 0,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
    expect(result.data?.chapter.title).toBe(attrs.title);
  });
});
