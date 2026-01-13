import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { toSlug } from "@zoonk/utils/string";
import { beforeAll, describe, expect, test } from "vitest";
import { addCourseAlternativeTitles } from "./add-course-alternative-titles";

describe("addCourseAlternativeTitles", () => {
  let org: Awaited<ReturnType<typeof organizationFixture>>;

  beforeAll(async () => {
    org = await organizationFixture();
  });

  test("adds alternative titles to course", async () => {
    const course = await courseFixture({ organizationId: org.id });
    const titles = [`Title A ${randomUUID()}`, `Title B ${randomUUID()}`];

    const result = await addCourseAlternativeTitles({
      courseId: course.id,
      language: "en",
      titles,
    });

    expect(result.error).toBeNull();

    const alternativeTitles = await prisma.courseAlternativeTitle.findMany({
      where: { courseId: course.id },
    });

    expect(alternativeTitles).toHaveLength(2);
    expect(alternativeTitles.map((t) => t.slug)).toEqual(
      expect.arrayContaining(titles.map((t) => toSlug(t))),
    );
  });

  test("skips duplicates", async () => {
    const course = await courseFixture({ organizationId: org.id });
    const title = `Duplicate Title ${randomUUID()}`;

    await addCourseAlternativeTitles({
      courseId: course.id,
      language: "en",
      titles: [title],
    });

    const result = await addCourseAlternativeTitles({
      courseId: course.id,
      language: "en",
      titles: [title, `New Title ${randomUUID()}`],
    });

    expect(result.error).toBeNull();

    const alternativeTitles = await prisma.courseAlternativeTitle.findMany({
      where: { courseId: course.id },
    });

    expect(alternativeTitles).toHaveLength(2);
  });
});
