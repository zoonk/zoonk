import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import {
  courseAlternativeTitleFixture,
  courseFixture,
} from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { beforeAll, describe, expect, test } from "vitest";
import { findExistingCourse } from "./find-existing-course";

describe("findExistingCourse", () => {
  let aiOrg: { id: number; slug: string };
  let otherOrg: Awaited<ReturnType<typeof organizationFixture>>;
  let aiCourse: Awaited<ReturnType<typeof courseFixture>>;
  let otherCourse: Awaited<ReturnType<typeof courseFixture>>;
  let testId: string;
  let aiCourseSlug: string;
  let otherCourseSlug: string;
  let aiAltTitleSlug: string;
  let otherAltTitleSlug: string;

  beforeAll(async () => {
    testId = randomUUID().slice(0, 8);
    aiCourseSlug = `test-ai-course-${testId}`;
    otherCourseSlug = `test-other-course-${testId}`;
    aiAltTitleSlug = `test-ai-alt-${testId}`;
    otherAltTitleSlug = `test-other-alt-${testId}`;

    aiOrg = await prisma.organization.upsert({
      create: { name: "AI", slug: AI_ORG_SLUG },
      update: {},
      where: { slug: AI_ORG_SLUG },
    });
    otherOrg = await organizationFixture();

    [aiCourse, otherCourse] = await Promise.all([
      courseFixture({
        generationStatus: "running",
        language: "en",
        organizationId: aiOrg.id,
        slug: aiCourseSlug,
      }),
      courseFixture({
        language: "en",
        organizationId: otherOrg.id,
        slug: otherCourseSlug,
      }),
    ]);

    await courseAlternativeTitleFixture({
      courseId: aiCourse.id,
      locale: "en",
      slug: aiAltTitleSlug,
    });

    await courseAlternativeTitleFixture({
      courseId: otherCourse.id,
      locale: "en",
      slug: otherAltTitleSlug,
    });
  });

  test("finds course by slug in AI organization", async () => {
    const result = await findExistingCourse({
      locale: "en",
      title: `Test AI Course ${testId}`,
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe(aiCourse.id);
    expect(result?.slug).toBe(aiCourseSlug);
    expect(result?.generationStatus).toBe("running");
  });

  test("finds course by alternative title in AI organization", async () => {
    const result = await findExistingCourse({
      locale: "en",
      title: `Test AI Alt ${testId}`,
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe(aiCourse.id);
    expect(result?.slug).toBe(aiCourseSlug);
  });

  test("returns null for course in non-AI organization", async () => {
    const result = await findExistingCourse({
      locale: "en",
      title: `Test Other Course ${testId}`,
    });

    expect(result).toBeNull();
  });

  test("returns null for alternative title in non-AI organization", async () => {
    const result = await findExistingCourse({
      locale: "en",
      title: `Test Other Alt ${testId}`,
    });

    expect(result).toBeNull();
  });

  test("returns null for non-existent course", async () => {
    const result = await findExistingCourse({
      locale: "en",
      title: "Non Existent Course",
    });

    expect(result).toBeNull();
  });

  test("filters by locale", async () => {
    const ptSlug = `test-pt-course-${testId}`;
    const ptCourse = await courseFixture({
      language: "pt",
      organizationId: aiOrg.id,
      slug: ptSlug,
    });

    const enResult = await findExistingCourse({
      locale: "en",
      title: `Test PT Course ${testId}`,
    });

    const ptResult = await findExistingCourse({
      locale: "pt",
      title: `Test PT Course ${testId}`,
    });

    expect(enResult).toBeNull();
    expect(ptResult).not.toBeNull();
    expect(ptResult?.id).toBe(ptCourse.id);
  });
});
