import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { type CourseContext } from "../steps/initialize-course-step";
import { type GeneratedContent } from "./generate-missing-content";
import { type ExistingCourseContent } from "./get-or-create-course";
import { persistGeneratedContent } from "./persist-generated-content";

const writeMock = vi.fn().mockResolvedValue(null);

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({
      releaseLock: vi.fn(),
      write: writeMock,
    }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

describe(persistGeneratedContent, () => {
  let organizationId: number;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("persists all generated content when nothing exists", async () => {
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
      alternativeTitles: [`Alt ${randomUUID()}`],
      categories: ["programming"],
      chapters: [
        { description: "Ch1 desc", title: `Chapter 1 ${randomUUID()}` },
        { description: "Ch2 desc", title: `Chapter 2 ${randomUUID()}` },
      ],
      description: "Generated description",
      imageUrl: "https://example.com/img.webp",
    };

    const existing: ExistingCourseContent = {
      description: null,
      hasAlternativeTitles: false,
      hasCategories: false,
      hasChapters: false,
      imageUrl: null,
    };

    const chapters = await persistGeneratedContent(courseContext, content, existing);

    expect(chapters).toHaveLength(2);

    const [dbCourse, dbChapters, dbCategories, dbAltTitles] = await Promise.all([
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      prisma.chapter.findMany({
        orderBy: { position: "asc" },
        where: { courseId: course.id },
      }),
      prisma.courseCategory.findMany({ where: { courseId: course.id } }),
      prisma.courseAlternativeTitle.findMany({ where: { courseId: course.id } }),
    ]);

    expect(dbCourse.description).toBe("Generated description");
    expect(dbCourse.imageUrl).toBe("https://example.com/img.webp");
    expect(dbChapters).toHaveLength(2);
    expect(dbCategories).toHaveLength(1);
    expect(dbAltTitles).toHaveLength(1);
  });

  test("skips persisting content that already exists", async () => {
    const course = await courseFixture({
      description: "Already has desc",
      imageUrl: "https://example.com/existing.webp",
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
      alternativeTitles: [],
      categories: [],
      chapters: [],
      description: "Already has desc",
      imageUrl: "https://example.com/existing.webp",
    };

    const existing: ExistingCourseContent = {
      description: "Already has desc",
      hasAlternativeTitles: true,
      hasCategories: true,
      hasChapters: true,
      imageUrl: "https://example.com/existing.webp",
    };

    const chapters = await persistGeneratedContent(courseContext, content, existing);

    expect(chapters).toEqual([]);

    const events = getStreamedEvents(writeMock);
    const completedSkips = events.filter((event) => event.status === "completed");

    expect(completedSkips.length).toBeGreaterThanOrEqual(4);
  });
});
