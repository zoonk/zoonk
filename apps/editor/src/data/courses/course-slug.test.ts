import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { courseAlternativeTitleFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import { memberFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { beforeAll, describe, expect, test } from "vitest";
import { courseSlugExistsForCreate, courseSlugExistsForUpdate } from "./course-slug";

async function getOrCreateAIOrg() {
  return prisma.organization.upsert({
    create: { name: "AI", slug: AI_ORG_SLUG },
    update: {},
    where: { slug: AI_ORG_SLUG },
  });
}

describe("courseSlugExistsForCreate()", () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;
  let headers: Headers;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    organization = fixture.organization;
    headers = await signInAs(fixture.user.email, fixture.user.password);
  });

  test("returns true when slug exists for same org", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    const exists = await courseSlugExistsForCreate({
      headers,
      language: "en",
      orgSlug: organization.slug,
      slug: course.slug,
    });

    expect(exists).toBe(true);
  });

  test("returns false when slug does not exist", async () => {
    const exists = await courseSlugExistsForCreate({
      headers,
      language: "en",
      orgSlug: organization.slug,
      slug: "non-existent-slug",
    });

    expect(exists).toBe(false);
  });

  test("returns true when slug exists regardless of language", async () => {
    const course = await courseFixture({
      language: "pt",
      organizationId: organization.id,
    });

    const exists = await courseSlugExistsForCreate({
      headers,
      language: "pt",
      orgSlug: organization.slug,
      slug: course.slug,
    });

    expect(exists).toBe(true);
  });

  test("returns false when user cannot create courses in the target organization", async () => {
    const otherOrg = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    const exists = await courseSlugExistsForCreate({
      headers,
      language: "en",
      orgSlug: otherOrg.slug,
      slug: course.slug,
    });

    expect(exists).toBe(false);
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
      const fixture = await memberFixture({ role: "admin" });
      const aiHeaders = await signInAs(fixture.user.email, fixture.user.password);

      await prisma.member.create({
        data: {
          organizationId: aiOrg.id,
          role: "admin",
          userId: fixture.user.id,
        },
      });

      const exists = await courseSlugExistsForCreate({
        headers: aiHeaders,
        language: "pt",
        orgSlug: aiOrg.slug,
        slug: `${altTitle.slug}-pt`,
      });

      expect(exists).toBe(true);
    });

    test("returns false when slug matches an alternative title in a different language", async () => {
      const course = await courseFixture({ language: "pt", organizationId: aiOrg.id });
      const fixture = await memberFixture({ role: "admin" });
      const aiHeaders = await signInAs(fixture.user.email, fixture.user.password);

      await prisma.member.create({
        data: {
          organizationId: aiOrg.id,
          role: "admin",
          userId: fixture.user.id,
        },
      });

      await courseAlternativeTitleFixture({
        courseId: course.id,
        language: "pt",
        slug: `alt-diff-lang-${course.id}`,
      });

      const exists = await courseSlugExistsForCreate({
        headers: aiHeaders,
        language: "es",
        orgSlug: aiOrg.slug,
        slug: `alt-diff-lang-${course.id}-es`,
      });

      expect(exists).toBe(false);
    });

    test("returns false when checking alternative titles for a non-AI org", async () => {
      const nonAiOrg = await organizationFixture();
      const course = await courseFixture({ language: "pt", organizationId: nonAiOrg.id });
      const altTitle = await courseAlternativeTitleFixture({
        courseId: course.id,
        language: "pt",
        slug: `alt-non-ai-${course.id}`,
      });

      const exists = await courseSlugExistsForCreate({
        headers,
        language: "pt",
        orgSlug: nonAiOrg.slug,
        slug: `${altTitle.slug}-pt`,
      });

      expect(exists).toBe(false);
    });
  });
});

describe("courseSlugExistsForUpdate()", () => {
  test("returns true when the user can update the course organization", async () => {
    const fixture = await memberFixture({ role: "admin" });
    const headers = await signInAs(fixture.user.email, fixture.user.password);
    const course = await courseFixture({ organizationId: fixture.organization.id });

    const exists = await courseSlugExistsForUpdate({
      courseId: course.id,
      headers,
      slug: course.slug,
    });

    expect(exists).toBe(true);
  });

  test("returns false when the user cannot update the target course organization", async () => {
    const fixture = await memberFixture({ role: "admin" });
    const headers = await signInAs(fixture.user.email, fixture.user.password);
    const otherOrg = await organizationFixture();
    const otherCourse = await courseFixture({ organizationId: otherOrg.id });

    const exists = await courseSlugExistsForUpdate({
      courseId: otherCourse.id,
      headers,
      slug: otherCourse.slug,
    });

    expect(exists).toBe(false);
  });
});
