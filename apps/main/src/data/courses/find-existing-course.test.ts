import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import {
  courseAlternativeTitleFixture,
  courseFixture,
} from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { toSlug } from "@zoonk/utils/string";
import { beforeAll, describe, expect, test } from "vitest";
import { findExistingCourse } from "./find-existing-course";

async function getOrCreateAIOrg() {
  return prisma.organization.upsert({
    create: { name: "AI", slug: AI_ORG_SLUG },
    update: {},
    where: { slug: AI_ORG_SLUG },
  });
}

describe("findExistingCourse", () => {
  let aiOrg: Awaited<ReturnType<typeof getOrCreateAIOrg>>;
  let nonAiOrg: Awaited<ReturnType<typeof organizationFixture>>;

  beforeAll(async () => {
    [aiOrg, nonAiOrg] = await Promise.all([
      getOrCreateAIOrg(),
      organizationFixture(),
    ]);
  });

  test("returns null when no course exists with slug/language", async () => {
    const result = await findExistingCourse({
      language: "en",
      slug: "non-existent-course",
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  test("returns course when found by slug + language in courses table (AI org)", async () => {
    const uniqueSlug = `ai-course-slug-${randomUUID()}`;

    const course = await courseFixture({
      generationStatus: "completed",
      language: "en",
      organizationId: aiOrg.id,
      slug: uniqueSlug,
    });

    const result = await findExistingCourse({
      language: "en",
      slug: uniqueSlug,
    });

    expect(result.error).toBeNull();

    expect(result.data).toEqual({
      generationStatus: course.generationStatus,
      id: course.id,
      slug: course.slug,
    });
  });

  test("returns course when found by slug + language in alternative titles table", async () => {
    const uniqueSlug = `original-course-slug-${randomUUID()}`;
    const altSlug = `alternative-slug-${randomUUID()}`;

    const course = await courseFixture({
      generationStatus: "completed",
      language: "en",
      organizationId: aiOrg.id,
      slug: uniqueSlug,
    });

    await courseAlternativeTitleFixture({
      courseId: course.id,
      language: "en",
      slug: altSlug,
    });

    const result = await findExistingCourse({
      language: "en",
      slug: altSlug,
    });

    expect(result.error).toBeNull();

    expect(result.data).toEqual({
      generationStatus: course.generationStatus,
      id: course.id,
      slug: course.slug,
    });
  });

  test("returns null for courses from non-AI organizations", async () => {
    const uniqueSlug = `non-ai-course-${randomUUID()}`;

    await courseFixture({
      language: "en",
      organizationId: nonAiOrg.id,
      slug: uniqueSlug,
    });

    const result = await findExistingCourse({
      language: "en",
      slug: uniqueSlug,
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  test("prioritizes direct course match over alternative title match", async () => {
    const uniqueSlug = `priority-test-slug-${randomUUID()}`;

    const directCourse = await courseFixture({
      generationStatus: "completed",
      language: "en",
      organizationId: aiOrg.id,
      slug: uniqueSlug,
    });

    const altCourse = await courseFixture({
      generationStatus: "pending",
      language: "en",
      organizationId: aiOrg.id,
      slug: `alt-course-for-priority-${randomUUID()}`,
    });

    await courseAlternativeTitleFixture({
      courseId: altCourse.id,
      language: "pt",
      slug: uniqueSlug,
    });

    const result = await findExistingCourse({
      language: "en",
      slug: uniqueSlug,
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(directCourse.id);
    expect(result.data?.generationStatus).toBe("completed");
  });

  test("handles slug normalization", async () => {
    const uniqueTitle = `My Course Title ${randomUUID()}`;

    const course = await courseFixture({
      language: "en",
      organizationId: aiOrg.id,
      slug: toSlug(uniqueTitle),
    });

    const result = await findExistingCourse({
      language: "en",
      slug: uniqueTitle,
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe(course.id);
  });

  test("handles different languages correctly", async () => {
    const uniqueSlug = `language-test-course-${randomUUID()}`;

    const [enCourse, ptCourse] = await Promise.all([
      courseFixture({
        language: "en",
        organizationId: aiOrg.id,
        slug: uniqueSlug,
      }),
      courseFixture({
        language: "pt",
        organizationId: aiOrg.id,
        slug: uniqueSlug,
      }),
    ]);

    const [enResult, ptResult] = await Promise.all([
      findExistingCourse({ language: "en", slug: uniqueSlug }),
      findExistingCourse({ language: "pt", slug: uniqueSlug }),
    ]);

    expect(enResult.error).toBeNull();
    expect(enResult.data?.id).toBe(enCourse.id);

    expect(ptResult.error).toBeNull();
    expect(ptResult.data?.id).toBe(ptCourse.id);
  });
});
