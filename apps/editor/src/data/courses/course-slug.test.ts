import { prisma } from "@zoonk/db";
import { courseAlternativeTitleFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { beforeAll, describe, expect, test } from "vitest";
import { courseSlugExists } from "./course-slug";

async function getOrCreateAIOrg() {
  return prisma.organization.upsert({
    create: { name: "AI", slug: AI_ORG_SLUG },
    update: {},
    where: { slug: AI_ORG_SLUG },
  });
}

describe("courseSlugExists()", () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;

  beforeAll(async () => {
    organization = await organizationFixture();
  });

  test("returns true when slug exists for same org", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    const exists = await courseSlugExists({
      language: "en",
      orgSlug: organization.slug,
      slug: course.slug,
    });

    expect(exists).toBeTruthy();
  });

  test("returns false when slug does not exist", async () => {
    const exists = await courseSlugExists({
      language: "en",
      orgSlug: organization.slug,
      slug: "non-existent-slug",
    });

    expect(exists).toBeFalsy();
  });

  test("returns true when slug exists regardless of language", async () => {
    const course = await courseFixture({
      language: "pt",
      organizationId: organization.id,
    });

    const exists = await courseSlugExists({
      language: "pt",
      orgSlug: organization.slug,
      slug: course.slug,
    });

    expect(exists).toBeTruthy();
  });

  test("returns false when slug exists but organization differs", async () => {
    const otherOrg = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    const exists = await courseSlugExists({
      language: "en",
      orgSlug: otherOrg.slug,
      slug: course.slug,
    });

    expect(exists).toBeFalsy();
  });

  describe("alternative titles (AI org)", () => {
    let aiOrg: Awaited<ReturnType<typeof getOrCreateAIOrg>>;

    beforeAll(async () => {
      aiOrg = await getOrCreateAIOrg();
    });

    test("returns true when slug matches an alternative title for same language", async () => {
      const course = await courseFixture({ language: "pt", organizationId: aiOrg.id });
      const altTitle = await courseAlternativeTitleFixture({
        courseId: course.id,
        language: "pt",
        slug: `alt-title-${course.id}`,
      });

      const exists = await courseSlugExists({
        language: "pt",
        orgSlug: aiOrg.slug,
        slug: `${altTitle.slug}-pt`,
      });

      expect(exists).toBeTruthy();
    });

    test("returns false when slug matches an alternative title in a different language", async () => {
      const course = await courseFixture({ language: "pt", organizationId: aiOrg.id });
      await courseAlternativeTitleFixture({
        courseId: course.id,
        language: "pt",
        slug: `alt-diff-lang-${course.id}`,
      });

      const exists = await courseSlugExists({
        language: "es",
        orgSlug: aiOrg.slug,
        slug: `alt-diff-lang-${course.id}-es`,
      });

      expect(exists).toBeFalsy();
    });

    test("returns false when checking alternative titles for a non-AI org", async () => {
      const nonAiOrg = await organizationFixture();
      const course = await courseFixture({ language: "pt", organizationId: nonAiOrg.id });
      const altTitle = await courseAlternativeTitleFixture({
        courseId: course.id,
        language: "pt",
        slug: `alt-non-ai-${course.id}`,
      });

      const exists = await courseSlugExists({
        language: "pt",
        orgSlug: nonAiOrg.slug,
        slug: `${altTitle.slug}-pt`,
      });

      expect(exists).toBeFalsy();
    });
  });
});
