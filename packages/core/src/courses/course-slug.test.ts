import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expect, test } from "vitest";
import { organizationFixture } from "@/fixtures/orgs";
import { userFixture } from "@/fixtures/users";
import { courseSlugExists } from "./course-slug";

test("returns true when slug exists for same language and org", async () => {
  const [organization, author] = await Promise.all([
    organizationFixture(),
    userFixture(),
  ]);

  const slug = `test-course-${randomUUID()}`;

  await prisma.course.create({
    data: {
      authorId: Number(author.id),
      description: "Test description",
      language: "en",
      normalizedTitle: "test course",
      organizationId: organization.id,
      slug,
      title: "Test Course",
    },
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
  const [organization, author] = await Promise.all([
    organizationFixture(),
    userFixture(),
  ]);
  const slug = `test-course-${randomUUID()}`;

  await prisma.course.create({
    data: {
      authorId: Number(author.id),
      description: "Test description",
      language: "en",
      normalizedTitle: "test course",
      organizationId: organization.id,
      slug,
      title: "Test Course",
    },
  });

  const exists = await courseSlugExists({
    language: "pt",
    orgSlug: organization.slug,
    slug,
  });

  expect(exists).toBe(false);
});

test("returns false when slug exists but organization differs", async () => {
  const [org1, org2, author] = await Promise.all([
    organizationFixture(),
    organizationFixture(),
    userFixture(),
  ]);

  const slug = `test-course-${randomUUID()}`;

  await prisma.course.create({
    data: {
      authorId: Number(author.id),
      description: "Test description",
      language: "en",
      normalizedTitle: "test course",
      organizationId: org1.id,
      slug,
      title: "Test Course",
    },
  });

  const exists = await courseSlugExists({
    language: "en",
    orgSlug: org2.slug,
    slug,
  });

  expect(exists).toBe(false);
});
