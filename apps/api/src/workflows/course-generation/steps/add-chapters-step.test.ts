import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { addChaptersStep } from "./add-chapters-step";
import { type CourseContext } from "./initialize-course-step";

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

describe(addChaptersStep, () => {
  let organizationId: string;
  let courseContext: CourseContext;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    courseContext = {
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: course.title,
      language: course.language,
      organizationId,
      targetLanguage: null,
    };
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("streams error and throws when DB save fails", async () => {
    const brokenContext: CourseContext = {
      ...courseContext,
      courseId: 999_999_999,
    };

    const chapters = [{ description: "Desc", title: `Chapter ${randomUUID()}` }];

    await expect(addChaptersStep({ chapters, course: brokenContext })).rejects.toThrow();

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "addChapters" }),
    );
  });

  test("creates chapters in the database and returns them", async () => {
    const course = await courseFixture({ organizationId });

    const context: CourseContext = {
      ...courseContext,
      courseId: course.id,
    };

    const chapters = [
      { description: "First chapter desc", title: `Chapter 1 ${randomUUID()}` },
      { description: "Second chapter desc", title: `Chapter 2 ${randomUUID()}` },
    ];

    const result = await addChaptersStep({ chapters, course: context });

    expect(result).toHaveLength(2);

    const dbChapters = await prisma.chapter.findMany({
      orderBy: { position: "asc" },
      where: { courseId: course.id },
    });

    expect(dbChapters).toHaveLength(2);
    expect(dbChapters[0]!.title).toBe(chapters[0]!.title);
    expect(dbChapters[0]!.description).toBe("First chapter desc");
    expect(dbChapters[0]!.generationStatus).toBe("pending");
    expect(dbChapters[0]!.isPublished).toBe(true);
    expect(dbChapters[0]!.position).toBe(0);
    expect(dbChapters[1]!.position).toBe(1);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "addChapters" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "addChapters" }),
    );
  });
});
