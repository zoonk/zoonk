import { randomUUID } from "node:crypto";
import { ErrorCode } from "@/lib/app-error";
import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { memberFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, test } from "vitest";
import { exportAlternativeTitles } from "./export-alternative-titles";

describe(exportAlternativeTitles, () => {
  test("returns Forbidden for unauthenticated users", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    const result = await exportAlternativeTitles({
      courseId: course.id,
      headers: new Headers(),
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

    const result = await exportAlternativeTitles({
      courseId: course.id,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });

  test("returns courseNotFound for non-existent course", async () => {
    const { user } = await memberFixture({ role: "admin" });
    const headers = await signInAs(user.email, user.password);

    const result = await exportAlternativeTitles({
      courseId: "00000000-0000-7000-8000-000000000001",
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.courseNotFound);
    expect(result.data).toBeNull();
  });

  test("exports titles successfully", async () => {
    const suffix = randomUUID().slice(0, 8);
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });
    const { user } = await memberFixture({ organizationId: organization.id, role: "admin" });
    const headers = await signInAs(user.email, user.password);

    await prisma.courseAlternativeTitle.createMany({
      data: [
        {
          courseId: course.id,
          language: "en",
          slug: `machine-learning-${suffix}`,
        },
        { courseId: course.id, language: "en", slug: `ml-basics-${suffix}` },
      ],
    });

    const result = await exportAlternativeTitles({
      courseId: course.id,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
    expect(result.data?.version).toBe(1);
    expect(result.data?.exportedAt).toBeDefined();
    expect(result.data?.alternativeTitles).toHaveLength(2);
  });

  test("exports empty array when no titles exist", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });
    const { user } = await memberFixture({ organizationId: organization.id, role: "admin" });
    const headers = await signInAs(user.email, user.password);

    const result = await exportAlternativeTitles({
      courseId: course.id,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data?.alternativeTitles).toEqual([]);
  });

  test("returns titles sorted alphabetically", async () => {
    const suffix = randomUUID().slice(0, 8);
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });
    const { user } = await memberFixture({ organizationId: organization.id, role: "admin" });
    const headers = await signInAs(user.email, user.password);

    await prisma.courseAlternativeTitle.createMany({
      data: [
        {
          courseId: course.id,
          language: "en",
          slug: `zebra-learning-${suffix}`,
        },
        { courseId: course.id, language: "en", slug: `alpha-course-${suffix}` },
        {
          courseId: course.id,
          language: "en",
          slug: `beta-training-${suffix}`,
        },
      ],
    });

    const result = await exportAlternativeTitles({
      courseId: course.id,
      headers,
    });

    expect(result.error).toBeNull();
    expect(result.data?.alternativeTitles).toEqual([
      `alpha-course-${suffix}`,
      `beta-training-${suffix}`,
      `zebra-learning-${suffix}`,
    ]);
  });

  test("returns Forbidden for courses in a different organization", async () => {
    const { user } = await memberFixture({ role: "admin" });
    const headers = await signInAs(user.email, user.password);
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });

    const result = await exportAlternativeTitles({
      courseId: otherCourse.id,
      headers,
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});
