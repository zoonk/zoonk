import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
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
      format: "core",
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
      chapterCount: 0,
      description: null,
      hasCategories: false,
      hasIntroductionLessons: false,
      hasMainCurriculum: false,
      imageUrl: null,
      landingPage: null,
    };

    const result = await persistGeneratedContent(courseContext, content, existing);

    expect(result).toHaveLength(2);

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
    expect(dbChapters.map((chapter) => chapter.position)).toStrictEqual([1, 2]);
    expect(dbChapters[0]?.imageUrl).toBeNull();
    expect(dbCategories).toHaveLength(1);
  });

  it("reserves position zero for the introduction when persisting main curriculum", async () => {
    const course = await courseFixture({
      generationStatus: "running",
      organizationId,
      title: `Persist Reserved Position ${randomUUID()}`,
    });

    const courseContext: CourseContext = {
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: course.title,
      format: "core",
      language: "en",
      organizationId,
      targetLanguage: null,
    };

    const content: GeneratedContent = {
      categories: [],
      chapters: [
        { description: "First main chapter", title: `Main One ${randomUUID()}` },
        { description: "Second main chapter", title: `Main Two ${randomUUID()}` },
      ],
      description: "Generated description",
      imageUrl: "https://example.com/img.webp",
      landingPage: null,
    };

    const existing: ExistingCourseContent = {
      chapterCount: 0,
      description: null,
      hasCategories: true,
      hasIntroductionLessons: false,
      hasMainCurriculum: false,
      imageUrl: "https://example.com/img.webp",
      landingPage: null,
    };

    await persistGeneratedContent(courseContext, content, existing);

    const dbChapters = await prisma.chapter.findMany({
      orderBy: { position: "asc" },
      where: { courseId: course.id },
    });

    expect(dbChapters.map((chapter) => chapter.position)).toStrictEqual([1, 2]);
  });

  it("persists language course metadata without landing page content", async () => {
    const course = await courseFixture({
      format: "language",
      generationStatus: "running",
      organizationId,
      targetLanguage: "es",
      title: `Persist Language ${randomUUID()}`,
    });

    const courseContext: CourseContext = {
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: course.title,
      format: "language",
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
      chapterCount: 0,
      description: null,
      hasCategories: false,
      hasIntroductionLessons: false,
      hasMainCurriculum: false,
      imageUrl: null,
      landingPage: null,
    };

    const result = await persistGeneratedContent(courseContext, content, existing);

    expect(result).toHaveLength(1);

    const dbCourse = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });

    expect(dbCourse.description).toBe("Generated language description");
    expect(dbCourse.imageUrl).toBe("https://example.com/language.webp");
    expect(dbCourse.landingPage).toBeNull();
  });

  it("appends generated curriculum after an existing intro chapter", async () => {
    const course = await courseFixture({
      generationStatus: "running",
      organizationId,
      title: `Persist Curriculum ${randomUUID()}`,
    });

    await chapterFixture({
      courseId: course.id,
      description: "Intro description",
      generationStatus: "completed",
      isPublished: true,
      organizationId,
      position: 0,
      title: "Intro",
    });

    const courseContext: CourseContext = {
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: course.title,
      format: "core",
      language: "en",
      organizationId,
      targetLanguage: null,
    };

    const content: GeneratedContent = {
      categories: [],
      chapters: [{ description: "Main chapter desc", title: `Main Chapter ${randomUUID()}` }],
      description: "Existing description",
      imageUrl: "",
      landingPage: null,
    };

    const existing: ExistingCourseContent = {
      chapterCount: 1,
      description: "Existing description",
      hasCategories: true,
      hasIntroductionLessons: true,
      hasMainCurriculum: false,
      imageUrl: null,
      landingPage: null,
    };

    const result = await persistGeneratedContent(courseContext, content, existing);

    expect(result).toHaveLength(1);

    const dbChapters = await prisma.chapter.findMany({
      orderBy: { position: "asc" },
      where: { courseId: course.id },
    });

    expect(dbChapters.map((chapter) => chapter.position)).toStrictEqual([0, 1]);
    expect(dbChapters[1]?.title).toBe(content.chapters[0]?.title);
  });

  it("does not append main curriculum again when retry already has main chapters", async () => {
    const course = await courseFixture({
      generationStatus: "running",
      organizationId,
      title: `Persist Missing Intro ${randomUUID()}`,
    });

    const existingMainChapter = await chapterFixture({
      courseId: course.id,
      description: "Existing main description",
      generationStatus: "pending",
      isPublished: true,
      organizationId,
      position: 1,
      title: `Existing Main ${randomUUID()}`,
    });

    const courseContext: CourseContext = {
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: course.title,
      format: "core",
      language: "en",
      organizationId,
      targetLanguage: null,
    };

    const content: GeneratedContent = {
      categories: [],
      chapters: [{ description: "Generated duplicate", title: `Generated Main ${randomUUID()}` }],
      description: "Existing description",
      imageUrl: "",
      landingPage: null,
    };

    const existing: ExistingCourseContent = {
      chapterCount: 1,
      description: "Existing description",
      hasCategories: true,
      hasIntroductionLessons: false,
      hasMainCurriculum: true,
      imageUrl: null,
      landingPage: null,
    };

    const result = await persistGeneratedContent(courseContext, content, existing);

    expect(result).toStrictEqual([]);

    const dbChapters = await prisma.chapter.findMany({
      orderBy: { position: "asc" },
      where: { courseId: course.id },
    });

    expect(dbChapters.map((chapter) => chapter.position)).toStrictEqual([1]);
    expect(dbChapters[0]?.id).toBe(existingMainChapter.id);
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
      format: "core",
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
      chapterCount: 2,
      description: "Already has desc",
      hasCategories: true,
      hasIntroductionLessons: true,
      hasMainCurriculum: true,
      imageUrl: "https://example.com/existing.webp",
      landingPage: {
        audience: ["Existing audience"],
        opportunities: ["Existing opportunity"],
        outcomes: ["Existing outcome"],
        valueProposition: "Existing value.",
      },
    };

    const result = await persistGeneratedContent(courseContext, content, existing);

    expect(result).toStrictEqual([]);

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
