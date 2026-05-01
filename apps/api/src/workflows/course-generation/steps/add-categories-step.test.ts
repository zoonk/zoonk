import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { addCategoriesStep } from "./add-categories-step";
import { type CourseContext } from "./initialize-course-step";

describe(addCategoriesStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates categories in the database", async () => {
    const course = await courseFixture({
      organizationId,
      title: `Categories Course ${randomUUID()}`,
    });

    const courseContext: CourseContext = {
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: course.title,
      language: "en",
      organizationId,
      targetLanguage: null,
    };

    await addCategoriesStep({ categories: ["programming", "web"], course: courseContext });

    const dbCategories = await prisma.courseCategory.findMany({ where: { courseId: course.id } });

    expect(dbCategories).toHaveLength(2);

    expect(dbCategories.map((cat) => cat.category).toSorted()).toStrictEqual([
      "programming",
      "web",
    ]);

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "addCategories" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "addCategories" }),
    );
  });

  it("skips duplicate categories without error", async () => {
    const course = await courseFixture({
      organizationId,
      title: `Dup Categories Course ${randomUUID()}`,
    });

    const courseContext: CourseContext = {
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: course.title,
      language: "en",
      organizationId,
      targetLanguage: null,
    };

    await addCategoriesStep({ categories: ["programming"], course: courseContext });

    await addCategoriesStep({ categories: ["programming", "web"], course: courseContext });

    const dbCategories = await prisma.courseCategory.findMany({ where: { courseId: course.id } });

    expect(dbCategories).toHaveLength(2);
  });
});
