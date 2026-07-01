import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type CourseContext } from "../steps/initialize-course-step";
import { type ExistingCourseContent } from "./existing-course-content";
import { type GeneratedContent } from "./generate-missing-content";
import { persistGeneratedContent } from "./persist-generated-content";

describe(persistGeneratedContent, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists all generated content when nothing exists", async () => {
    const course = await courseFixture({
      generationStatus: "running",
      organizationId,
      title: `Persist All ${randomUUID()}`,
    });

    const courseContext: CourseContext = {
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: course.title,
      language: "en",
      organizationId,
      targetLanguage: null,
    };

    const content: GeneratedContent = {
      categories: ["programming"],
      chapters: [
        { description: "Ch1 desc", title: `Chapter 1 ${randomUUID()}` },
        { description: "Ch2 desc", title: `Chapter 2 ${randomUUID()}` },
      ],
      description: "Generated description",
      imageUrl: "https://example.com/img.webp",
      landingPage: {
        audience: ["New learners"],
        opportunities: ["Use this in real projects"],
        outcomes: ["Build practical skill"],
        valueProposition: "A clear path into the subject.",
      },
    };

    const existing: ExistingCourseContent = {
      description: null,
      hasCategories: false,
      hasChapters: false,
      imageUrl: null,
      landingPage: null,
    };

    const chapters = await persistGeneratedContent(courseContext, content, existing);

    expect(chapters).toHaveLength(2);

    const [dbCourse, dbChapters, dbCategories] = await Promise.all([
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      prisma.chapter.findMany({ orderBy: { position: "asc" }, where: { courseId: course.id } }),
      prisma.courseCategory.findMany({ where: { courseId: course.id } }),
    ]);

    expect(dbCourse.description).toBe("Generated description");
    expect(dbCourse.imageUrl).toBe("https://example.com/img.webp");

    expect(dbCourse.landingPage).toStrictEqual({
      audience: ["New learners"],
      opportunities: ["Use this in real projects"],
      outcomes: ["Build practical skill"],
      valueProposition: "A clear path into the subject.",
    });

    expect(dbChapters).toHaveLength(2);
    expect(dbChapters[0]?.imageUrl).toBeNull();
    expect(dbCategories).toHaveLength(1);
  });

  it("persists language course metadata without landing page content", async () => {
    const course = await courseFixture({
      generationStatus: "running",
      organizationId,
      targetLanguage: "es",
      title: `Persist Language ${randomUUID()}`,
    });

    const courseContext: CourseContext = {
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: course.title,
      language: "en",
      organizationId,
      targetLanguage: "es",
    };

    const content: GeneratedContent = {
      categories: ["languages"],
      chapters: [{ description: "Language ch desc", title: `Language Ch ${randomUUID()}` }],
      description: "Generated language description",
      imageUrl: "https://example.com/language.webp",
      landingPage: null,
    };

    const existing: ExistingCourseContent = {
      description: null,
      hasCategories: false,
      hasChapters: false,
      imageUrl: null,
      landingPage: null,
    };

    const chapters = await persistGeneratedContent(courseContext, content, existing);

    expect(chapters).toHaveLength(1);

    const dbCourse = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });

    expect(dbCourse.description).toBe("Generated language description");
    expect(dbCourse.imageUrl).toBe("https://example.com/language.webp");
    expect(dbCourse.landingPage).toBeNull();
  });

  it("skips persisting content that already exists", async () => {
    const course = await courseFixture({
      description: "Already has desc",
      imageUrl: "https://example.com/existing.webp",
      landingPage: {
        audience: ["Existing audience"],
        opportunities: ["Existing opportunity"],
        outcomes: ["Existing outcome"],
        valueProposition: "Existing value.",
      },
      organizationId,
      title: `Persist Skip ${randomUUID()}`,
    });

    const courseContext: CourseContext = {
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: course.title,
      language: "en",
      organizationId,
      targetLanguage: null,
    };

    const content: GeneratedContent = {
      categories: [],
      chapters: [],
      description: "Already has desc",
      imageUrl: "https://example.com/existing.webp",
      landingPage: {
        audience: ["Existing audience"],
        opportunities: ["Existing opportunity"],
        outcomes: ["Existing outcome"],
        valueProposition: "Existing value.",
      },
    };

    const existing: ExistingCourseContent = {
      description: "Already has desc",
      hasCategories: true,
      hasChapters: true,
      imageUrl: "https://example.com/existing.webp",
      landingPage: {
        audience: ["Existing audience"],
        opportunities: ["Existing opportunity"],
        outcomes: ["Existing outcome"],
        valueProposition: "Existing value.",
      },
    };

    const chapters = await persistGeneratedContent(courseContext, content, existing);

    expect(chapters).toStrictEqual([]);

    const events = getStreamedEvents();

    const completedSteps = events
      .filter((event) => event.status === "completed")
      .map((event) => event.step);

    expect(completedSteps).toHaveLength(3);

    expect(completedSteps).toStrictEqual(
      expect.arrayContaining(["updateCourse", "addCategories", "addChapters"]),
    );
  });
});
