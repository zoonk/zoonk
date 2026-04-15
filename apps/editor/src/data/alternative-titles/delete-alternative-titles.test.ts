import { randomUUID } from "node:crypto";
import { ErrorCode } from "@/lib/app-error";
import { addAlternativeTitles } from "@zoonk/core/alternative-titles/add";
import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { memberFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, test } from "vitest";
import { deleteAlternativeTitles } from "./delete-alternative-titles";

describe(deleteAlternativeTitles, () => {
  test("returns Forbidden for unauthenticated users", async () => {
    const org = await organizationFixture();
    const course = await courseFixture({ organizationId: org.id });

    const result = await deleteAlternativeTitles({
      courseId: course.id,
      headers: new Headers(),
      titles: ["frontend-development"],
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });

  test("returns Forbidden for org members", async () => {
    const { organization, user } = await memberFixture({ role: "member" });

    const [headers, course] = await Promise.all([
      signInAs(user.email, user.password),
      courseFixture({ organizationId: organization.id }),
    ]);

    const result = await deleteAlternativeTitles({
      courseId: course.id,
      headers,
      titles: ["frontend-development"],
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });

  test("deletes specific alternative titles from a course", async () => {
    const org = await organizationFixture();
    const course = await courseFixture({ organizationId: org.id });
    const { user } = await memberFixture({ organizationId: org.id, role: "admin" });
    const headers = await signInAs(user.email, user.password);

    const suffix = randomUUID().slice(0, 8);
    const title1 = `frontend-development-${suffix}`;
    const title2 = `frontend-engineering-${suffix}`;
    const title3 = `frontend-dev-${suffix}`;

    await addAlternativeTitles({
      courseId: course.id,
      language: "en",
      titles: [title1, title2, title3],
    });

    const result = await deleteAlternativeTitles({
      courseId: course.id,
      headers,
      titles: [title1],
    });

    expect(result.error).toBeNull();

    const remaining = await prisma.courseAlternativeTitle.findMany({
      orderBy: { slug: "asc" },
      select: { slug: true },
      where: { courseId: course.id },
    });

    expect(remaining).toEqual([{ slug: title3 }, { slug: title2 }]);
  });

  test("deletes multiple titles at once", async () => {
    const org = await organizationFixture();
    const course = await courseFixture({ organizationId: org.id });
    const { user } = await memberFixture({ organizationId: org.id, role: "admin" });
    const headers = await signInAs(user.email, user.password);

    const suffix = randomUUID().slice(0, 8);

    await addAlternativeTitles({
      courseId: course.id,
      language: "en",
      titles: [`react-${suffix}`, `vue-${suffix}`, `angular-${suffix}`],
    });

    const result = await deleteAlternativeTitles({
      courseId: course.id,
      headers,
      titles: [`react-${suffix}`, `angular-${suffix}`],
    });

    expect(result.error).toBeNull();

    const remaining = await prisma.courseAlternativeTitle.findMany({
      select: { slug: true },
      where: { courseId: course.id },
    });

    expect(remaining).toEqual([{ slug: `vue-${suffix}` }]);
  });

  test("handles deleting non-existent titles gracefully", async () => {
    const org = await organizationFixture();
    const course = await courseFixture({ organizationId: org.id });
    const { user } = await memberFixture({ organizationId: org.id, role: "admin" });
    const headers = await signInAs(user.email, user.password);

    const suffix = randomUUID().slice(0, 8);

    await addAlternativeTitles({
      courseId: course.id,
      language: "en",
      titles: [`python-${suffix}`],
    });

    const result = await deleteAlternativeTitles({
      courseId: course.id,
      headers,
      titles: ["nonexistent-title"],
    });

    expect(result.error).toBeNull();

    const remaining = await prisma.courseAlternativeTitle.findMany({
      select: { slug: true },
      where: { courseId: course.id },
    });

    expect(remaining).toEqual([{ slug: `python-${suffix}` }]);
  });

  test("does nothing when titles array is empty", async () => {
    const org = await organizationFixture();
    const course = await courseFixture({ organizationId: org.id });
    const { user } = await memberFixture({ organizationId: org.id, role: "admin" });
    const headers = await signInAs(user.email, user.password);

    const suffix = randomUUID().slice(0, 8);

    await addAlternativeTitles({
      courseId: course.id,
      language: "en",
      titles: [`javascript-${suffix}`],
    });

    const result = await deleteAlternativeTitles({
      courseId: course.id,
      headers,
      titles: [],
    });

    expect(result.error).toBeNull();

    const remaining = await prisma.courseAlternativeTitle.findMany({
      select: { slug: true },
      where: { courseId: course.id },
    });

    expect(remaining).toEqual([{ slug: `javascript-${suffix}` }]);
  });

  test("only deletes titles from the specified course", async () => {
    const org = await organizationFixture();
    const course1 = await courseFixture({ organizationId: org.id });
    const course2 = await courseFixture({ organizationId: org.id });
    const { user } = await memberFixture({ organizationId: org.id, role: "admin" });
    const headers = await signInAs(user.email, user.password);

    const suffix = randomUUID().slice(0, 8);

    await addAlternativeTitles({
      courseId: course1.id,
      language: "en",
      titles: [`typescript-${suffix}`],
    });

    await addAlternativeTitles({
      courseId: course2.id,
      language: "en",
      titles: [`go-programming-${suffix}`],
    });

    const result = await deleteAlternativeTitles({
      courseId: course1.id,
      headers,
      titles: [`typescript-${suffix}`, `go-programming-${suffix}`],
    });

    expect(result.error).toBeNull();

    const course1Titles = await prisma.courseAlternativeTitle.findMany({
      where: { courseId: course1.id },
    });

    const course2Titles = await prisma.courseAlternativeTitle.findMany({
      select: { slug: true },
      where: { courseId: course2.id },
    });

    expect(course1Titles).toEqual([]);
    expect(course2Titles).toEqual([{ slug: `go-programming-${suffix}` }]);
  });

  test("returns Forbidden for courses in a different organization", async () => {
    const { user } = await memberFixture({ role: "admin" });
    const headers = await signInAs(user.email, user.password);
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });

    const result = await deleteAlternativeTitles({
      courseId: otherCourse.id,
      headers,
      titles: ["frontend-development"],
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});
