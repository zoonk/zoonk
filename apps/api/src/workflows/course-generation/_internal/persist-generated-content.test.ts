import { courseContext, curriculumChapters } from "@/workflows/_test-utils/curriculum";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, it } from "vitest";
import { EMPTY_EXISTING_CONTENT } from "./existing-course-content";
import { persistGeneratedContent } from "./persist-generated-content";

const content = {
  categories: ["science"],
  chapters: (["overview", "basic", "intermediate", "advanced"] as const).flatMap((level) =>
    curriculumChapters(level),
  ),
  description: "Explore one idea at a time",
  imageUrl: "https://example.com/course.webp",
  landingPage: {
    audience: ["Curious people"],
    opportunities: ["Apply ideas"],
    outcomes: ["Explain a useful idea"],
    valueProposition: "Understand the subject",
  },
};

describe(persistGeneratedContent, () => {
  it("saves metadata before the atomic outline advances the revision", async () => {
    const organization = await aiOrganizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    const chapters = await persistGeneratedContent(
      courseContext(course),
      content,
      EMPTY_EXISTING_CONTENT,
    );

    expect(chapters).toHaveLength(6);

    const saved = await prisma.course.findUniqueOrThrow({
      include: { categories: true },
      where: { id: course.id },
    });

    expect(saved.description).toBe(content.description);
    expect(saved.landingPage).toStrictEqual(content.landingPage);
    expect(saved.categories.map((category) => category.category)).toStrictEqual(["science"]);
    expect(saved.contentRevision).toBe(course.contentRevision + 1);
  });

  it("does not overwrite content after another curriculum has replaced the captured revision", async () => {
    const organization = await aiOrganizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    await prisma.course.update({
      data: { contentRevision: course.contentRevision + 1, description: "New current description" },
      where: { id: course.id },
    });

    const chapters = await persistGeneratedContent(
      courseContext(course),
      content,
      EMPTY_EXISTING_CONTENT,
    );

    expect(chapters).toStrictEqual([]);

    const savedSnapshot1 = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });

    expect(savedSnapshot1.description).toBe("New current description");

    await expect(prisma.courseCategory.count({ where: { courseId: course.id } })).resolves.toBe(0);
  });

  it("reuses existing language metadata without requiring a generated landing page", async () => {
    const organization = await aiOrganizationFixture();

    const course = await courseFixture({
      format: "language",
      organizationId: organization.id,
      targetLanguage: "pl",
    });

    const chapters = await persistGeneratedContent(
      courseContext(course),
      { ...content, chapters: [], landingPage: null },
      {
        ...EMPTY_EXISTING_CONTENT,
        description: course.description,
        hasCategories: true,
        hasMainCurriculum: true,
        imageUrl: "https://example.com/existing.webp",
      },
    );

    expect(chapters).toStrictEqual([]);

    const savedSnapshot2 = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });

    expect(savedSnapshot2.description).toBe(course.description);
  });
});
