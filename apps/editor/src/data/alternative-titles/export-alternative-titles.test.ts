import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, test } from "vitest";
import { ErrorCode } from "@/lib/app-error";
import { exportAlternativeTitles } from "./export-alternative-titles";

describe("exportAlternativeTitles", () => {
  test("returns courseNotFound for non-existent course", async () => {
    const result = await exportAlternativeTitles({
      courseId: 999_999,
    });

    expect(result.error?.message).toBe(ErrorCode.courseNotFound);
    expect(result.data).toBeNull();
  });

  test("exports titles successfully", async () => {
    const suffix = randomUUID().slice(0, 8);
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

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

    const result = await exportAlternativeTitles({
      courseId: course.id,
    });

    expect(result.error).toBeNull();
    expect(result.data?.alternativeTitles).toEqual([]);
  });

  test("returns titles sorted alphabetically", async () => {
    const suffix = randomUUID().slice(0, 8);
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

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
    });

    expect(result.error).toBeNull();
    expect(result.data?.alternativeTitles).toEqual([
      `alpha-course-${suffix}`,
      `beta-training-${suffix}`,
      `zebra-learning-${suffix}`,
    ]);
  });
});
