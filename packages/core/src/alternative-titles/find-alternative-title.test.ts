import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { describe, expect, test } from "vitest";
import { addAlternativeTitles } from "./add-alternative-titles";
import { findAlternativeTitle } from "./find-alternative-title";

async function getOrCreateAIOrg() {
  return prisma.organization.upsert({
    create: { name: "AI", slug: AI_ORG_SLUG },
    update: {},
    where: { slug: AI_ORG_SLUG },
  });
}

describe("findAlternativeTitle", () => {
  test("returns course when alternative title matches", async () => {
    const org = await getOrCreateAIOrg();
    const course = await courseFixture({
      language: "en",
      organizationId: org.id,
    });

    const uniqueTitle = `Frontend Development ${randomUUID()}`;

    await addAlternativeTitles({
      courseId: course.id,
      locale: "en",
      titles: [uniqueTitle],
    });

    const result = await findAlternativeTitle({
      locale: "en",
      title: uniqueTitle,
    });

    expect(result).toEqual({ language: "en", slug: course.slug });
  });

  test("returns course when title matches with different casing", async () => {
    const org = await getOrCreateAIOrg();
    const course = await courseFixture({
      language: "en",
      organizationId: org.id,
    });

    const uniqueTitle = `Machine Learning ${randomUUID()}`;

    await addAlternativeTitles({
      courseId: course.id,
      locale: "en",
      titles: [uniqueTitle],
    });

    const result = await findAlternativeTitle({
      locale: "en",
      title: uniqueTitle.toLowerCase(),
    });

    expect(result).toEqual({ language: "en", slug: course.slug });
  });

  test("returns null when title does not match", async () => {
    const result = await findAlternativeTitle({
      locale: "en",
      title: `Nonexistent Course ${randomUUID()}`,
    });

    expect(result).toBeNull();
  });

  test("returns null when course belongs to non-AI org", async () => {
    const org = await organizationFixture();
    const course = await courseFixture({
      language: "en",
      organizationId: org.id,
    });

    const uniqueTitle = `React Development ${randomUUID()}`;

    await addAlternativeTitles({
      courseId: course.id,
      locale: "en",
      titles: [uniqueTitle],
    });

    const result = await findAlternativeTitle({
      locale: "en",
      title: uniqueTitle,
    });

    expect(result).toBeNull();
  });

  test("returns null when locale does not match", async () => {
    const org = await getOrCreateAIOrg();
    const course = await courseFixture({
      language: "en",
      organizationId: org.id,
    });

    const uniqueTitle = `Python Programming ${randomUUID()}`;

    await addAlternativeTitles({
      courseId: course.id,
      locale: "en",
      titles: [uniqueTitle],
    });

    const result = await findAlternativeTitle({
      locale: "pt",
      title: uniqueTitle,
    });

    expect(result).toBeNull();
  });
});
