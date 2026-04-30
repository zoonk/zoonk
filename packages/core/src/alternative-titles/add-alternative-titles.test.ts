import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, it } from "vitest";
import { addAlternativeTitles } from "./add-alternative-titles";

describe(addAlternativeTitles, () => {
  it("adds alternative titles to a course", async () => {
    const org = await organizationFixture();
    const course = await courseFixture({ organizationId: org.id });

    const suffix = randomUUID().slice(0, 8);

    await addAlternativeTitles({
      courseId: course.id,
      language: "en",
      titles: [`Frontend Development ${suffix}`, `Frontend Engineering ${suffix}`],
    });

    const titles = await prisma.courseAlternativeTitle.findMany({
      orderBy: { slug: "asc" },
      select: { slug: true },
      where: { courseId: course.id },
    });

    expect(titles).toStrictEqual([
      { slug: `frontend-development-${suffix}` },
      { slug: `frontend-engineering-${suffix}` },
    ]);
  });

  it("converts titles to slugs", async () => {
    const org = await organizationFixture();
    const course = await courseFixture({ organizationId: org.id });

    const suffix = randomUUID().slice(0, 8);

    await addAlternativeTitles({
      courseId: course.id,
      language: "en",
      titles: [`Machine Learning Basics! ${suffix}`],
    });

    const titles = await prisma.courseAlternativeTitle.findMany({
      select: { slug: true },
      where: { courseId: course.id },
    });

    expect(titles).toStrictEqual([{ slug: `machine-learning-basics-${suffix}` }]);
  });

  it("removes duplicate titles", async () => {
    const org = await organizationFixture();
    const course = await courseFixture({ organizationId: org.id });

    const suffix = randomUUID().slice(0, 8);
    const title = `React ${suffix}`;

    await addAlternativeTitles({
      courseId: course.id,
      language: "en",
      titles: [title, title, title.toLowerCase()],
    });

    const titles = await prisma.courseAlternativeTitle.findMany({
      select: { slug: true },
      where: { courseId: course.id },
    });

    expect(titles).toStrictEqual([{ slug: `react-${suffix}` }]);
  });

  it("silently ignores duplicate titles across courses", async () => {
    const org = await organizationFixture();
    const course1 = await courseFixture({ organizationId: org.id });
    const course2 = await courseFixture({ organizationId: org.id });

    const suffix = randomUUID().slice(0, 8);
    const sharedTitle = `Vue.js ${suffix}`;
    const uniqueTitle = `Angular ${suffix}`;

    await addAlternativeTitles({ courseId: course1.id, language: "en", titles: [sharedTitle] });

    await addAlternativeTitles({
      courseId: course2.id,
      language: "en",
      titles: [sharedTitle, uniqueTitle],
    });

    const course2Titles = await prisma.courseAlternativeTitle.findMany({
      select: { slug: true },
      where: { courseId: course2.id },
    });

    expect(course2Titles).toStrictEqual([{ slug: `angular-${suffix}` }]);
  });

  it("does nothing when titles array is empty", async () => {
    const org = await organizationFixture();
    const course = await courseFixture({ organizationId: org.id });

    await addAlternativeTitles({ courseId: course.id, language: "en", titles: [] });

    const titles = await prisma.courseAlternativeTitle.findMany({ where: { courseId: course.id } });

    expect(titles).toStrictEqual([]);
  });

  it("filters out empty slugs", async () => {
    const org = await organizationFixture();
    const course = await courseFixture({ organizationId: org.id });

    const suffix = randomUUID().slice(0, 8);

    await addAlternativeTitles({
      courseId: course.id,
      language: "en",
      titles: ["", "   ", `Valid Title ${suffix}`],
    });

    const titles = await prisma.courseAlternativeTitle.findMany({
      select: { slug: true },
      where: { courseId: course.id },
    });

    expect(titles).toStrictEqual([{ slug: `valid-title-${suffix}` }]);
  });
});
