import { randomUUID } from "node:crypto";
import { addAlternativeTitles } from "@zoonk/core/alternative-titles/add";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, test } from "vitest";
import { listAlternativeTitles } from "./list-alternative-titles";

describe("listAlternativeTitles", () => {
  test("returns all alternative titles for a course", async () => {
    const org = await organizationFixture();
    const course = await courseFixture({ organizationId: org.id });

    const suffix = randomUUID().slice(0, 8);

    await addAlternativeTitles({
      courseId: course.id,
      locale: "en",
      titles: [`aaa-${suffix}`, `bbb-${suffix}`, `ccc-${suffix}`],
    });

    const result = await listAlternativeTitles({ courseId: course.id });

    expect(result).toEqual([`aaa-${suffix}`, `bbb-${suffix}`, `ccc-${suffix}`]);
  });

  test("returns empty array when course has no alternative titles", async () => {
    const org = await organizationFixture();
    const course = await courseFixture({ organizationId: org.id });

    const result = await listAlternativeTitles({ courseId: course.id });

    expect(result).toEqual([]);
  });

  test("returns titles sorted alphabetically", async () => {
    const org = await organizationFixture();
    const course = await courseFixture({ organizationId: org.id });

    const suffix = randomUUID().slice(0, 8);

    await addAlternativeTitles({
      courseId: course.id,
      locale: "en",
      titles: [`zebra-${suffix}`, `apple-${suffix}`, `mango-${suffix}`],
    });

    const result = await listAlternativeTitles({ courseId: course.id });

    expect(result).toEqual([
      `apple-${suffix}`,
      `mango-${suffix}`,
      `zebra-${suffix}`,
    ]);
  });

  test("returns alternative titles by course slug", async () => {
    const org = await organizationFixture();
    const course = await courseFixture({ organizationId: org.id });

    const suffix = randomUUID().slice(0, 8);

    await addAlternativeTitles({
      courseId: course.id,
      locale: "en",
      titles: [`foo-${suffix}`, `bar-${suffix}`],
    });

    const result = await listAlternativeTitles({ courseSlug: course.slug });

    expect(result).toEqual([`bar-${suffix}`, `foo-${suffix}`]);
  });
});
