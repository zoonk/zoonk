import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, test } from "vitest";
import { addAlternativeTitles } from "./add-alternative-titles";
import { deleteAlternativeTitles } from "./delete-alternative-titles";

describe("deleteAlternativeTitles", () => {
  test("deletes specific alternative titles from a course", async () => {
    const org = await organizationFixture();
    const course = await courseFixture({ organizationId: org.id });

    const suffix = randomUUID().slice(0, 8);
    const title1 = `frontend-development-${suffix}`;
    const title2 = `frontend-engineering-${suffix}`;
    const title3 = `frontend-dev-${suffix}`;

    await addAlternativeTitles({
      courseId: course.id,
      locale: "en",
      titles: [title1, title2, title3],
    });

    await deleteAlternativeTitles({
      courseId: course.id,
      titles: [title1],
    });

    const remaining = await prisma.courseAlternativeTitle.findMany({
      orderBy: { slug: "asc" },
      select: { slug: true },
      where: { courseId: course.id },
    });

    expect(remaining).toEqual([{ slug: title3 }, { slug: title2 }]);
  });

  test("deletes multiple titles at once", async () => {
    const org = await organizationFixture();
    const course = await courseFixture({ organizationId: org.id });

    const suffix = randomUUID().slice(0, 8);

    await addAlternativeTitles({
      courseId: course.id,
      locale: "en",
      titles: [`react-${suffix}`, `vue-${suffix}`, `angular-${suffix}`],
    });

    await deleteAlternativeTitles({
      courseId: course.id,
      titles: [`react-${suffix}`, `angular-${suffix}`],
    });

    const remaining = await prisma.courseAlternativeTitle.findMany({
      select: { slug: true },
      where: { courseId: course.id },
    });

    expect(remaining).toEqual([{ slug: `vue-${suffix}` }]);
  });

  test("handles deleting non-existent titles gracefully", async () => {
    const org = await organizationFixture();
    const course = await courseFixture({ organizationId: org.id });

    const suffix = randomUUID().slice(0, 8);

    await addAlternativeTitles({
      courseId: course.id,
      locale: "en",
      titles: [`python-${suffix}`],
    });

    await deleteAlternativeTitles({
      courseId: course.id,
      titles: ["nonexistent-title"],
    });

    const remaining = await prisma.courseAlternativeTitle.findMany({
      select: { slug: true },
      where: { courseId: course.id },
    });

    expect(remaining).toEqual([{ slug: `python-${suffix}` }]);
  });

  test("does nothing when titles array is empty", async () => {
    const org = await organizationFixture();
    const course = await courseFixture({ organizationId: org.id });

    const suffix = randomUUID().slice(0, 8);

    await addAlternativeTitles({
      courseId: course.id,
      locale: "en",
      titles: [`javascript-${suffix}`],
    });

    await deleteAlternativeTitles({
      courseId: course.id,
      titles: [],
    });

    const remaining = await prisma.courseAlternativeTitle.findMany({
      select: { slug: true },
      where: { courseId: course.id },
    });

    expect(remaining).toEqual([{ slug: `javascript-${suffix}` }]);
  });

  test("only deletes titles from the specified course", async () => {
    const org = await organizationFixture();
    const course1 = await courseFixture({ organizationId: org.id });
    const course2 = await courseFixture({ organizationId: org.id });

    const suffix = randomUUID().slice(0, 8);

    await addAlternativeTitles({
      courseId: course1.id,
      locale: "en",
      titles: [`typescript-${suffix}`],
    });

    await addAlternativeTitles({
      courseId: course2.id,
      locale: "en",
      titles: [`go-programming-${suffix}`],
    });

    await deleteAlternativeTitles({
      courseId: course1.id,
      titles: [`typescript-${suffix}`, `go-programming-${suffix}`],
    });

    const course1Titles = await prisma.courseAlternativeTitle.findMany({
      where: { courseId: course1.id },
    });

    const course2Titles = await prisma.courseAlternativeTitle.findMany({
      select: { slug: true },
      where: { courseId: course2.id },
    });

    expect(course1Titles).toEqual([]);
    expect(course2Titles).toEqual([{ slug: `go-programming-${suffix}` }]);
  });
});
