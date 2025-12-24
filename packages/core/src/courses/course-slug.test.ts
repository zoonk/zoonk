import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { courseFixture } from "@/fixtures/courses";
import { organizationFixture } from "@/fixtures/orgs";
import { courseSlugExists } from "./course-slug";

test("returns true when slug exists for same language and org", async () => {
  const organization = await organizationFixture();

  const slug = `test-course-${randomUUID()}`;

  await courseFixture({
    organizationId: organization.id,
    slug,
  });

  const exists = await courseSlugExists({
    language: "en",
    orgSlug: organization.slug,
    slug,
  });

  expect(exists).toBe(true);
});

test("returns false when slug does not exist", async () => {
  const organization = await organizationFixture();

  const exists = await courseSlugExists({
    language: "en",
    orgSlug: organization.slug,
    slug: "non-existent-slug",
  });

  expect(exists).toBe(false);
});

test("returns false when slug exists but language differs", async () => {
  const organization = await organizationFixture();
  const slug = `test-course-${randomUUID()}`;

  await courseFixture({
    language: "en",
    organizationId: organization.id,
    slug,
  });

  const exists = await courseSlugExists({
    language: "pt",
    orgSlug: organization.slug,
    slug,
  });

  expect(exists).toBe(false);
});

test("returns false when slug exists but organization differs", async () => {
  const [org1, org2] = await Promise.all([
    organizationFixture(),
    organizationFixture(),
  ]);

  const slug = `test-course-${randomUUID()}`;

  await courseFixture({
    language: "en",
    organizationId: org1.id,
    slug,
  });

  const exists = await courseSlugExists({
    language: "en",
    orgSlug: org2.slug,
    slug,
  });

  expect(exists).toBe(false);
});
