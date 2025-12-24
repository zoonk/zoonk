import { describe, expect, test } from "vitest";
import { courseFixture } from "@/fixtures/courses";
import { organizationFixture } from "@/fixtures/orgs";
import { courseSlugExists } from "./course-slug";

describe("courseSlugExists()", async () => {
  const organization = await organizationFixture();

  test("returns true when slug exists for same language and org", async () => {
    const course = await courseFixture({ organizationId: organization.id });

    const exists = await courseSlugExists({
      language: course.language,
      orgSlug: organization.slug,
      slug: course.slug,
    });

    expect(exists).toBe(true);
  });

  test("returns false when slug does not exist", async () => {
    const exists = await courseSlugExists({
      language: "en",
      orgSlug: organization.slug,
      slug: "non-existent-slug",
    });

    expect(exists).toBe(false);
  });

  test("returns false when slug exists but language differs", async () => {
    const course = await courseFixture({
      language: "en",
      organizationId: organization.id,
    });

    const exists = await courseSlugExists({
      language: "pt",
      orgSlug: organization.slug,
      slug: course.slug,
    });

    expect(exists).toBe(false);
  });

  test("returns false when slug exists but organization differs", async () => {
    const otherOrg = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    const exists = await courseSlugExists({
      language: course.language,
      orgSlug: otherOrg.slug,
      slug: course.slug,
    });

    expect(exists).toBe(false);
  });
});
