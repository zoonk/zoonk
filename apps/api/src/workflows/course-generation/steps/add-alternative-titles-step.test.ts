import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { addAlternativeTitlesStep } from "./add-alternative-titles-step";
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

describe(addAlternativeTitlesStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("streams error and throws when DB save fails", async () => {
    const brokenContext: CourseContext = {
      courseId: randomUUID(),
      courseSlug: "broken",
      courseTitle: "Broken",
      language: "en",
      organizationId,
      targetLanguage: null,
    };

    await expect(
      addAlternativeTitlesStep({
        alternativeTitles: [`Alt ${randomUUID()}`],
        course: brokenContext,
      }),
    ).rejects.toThrow();

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "addAlternativeTitles" }),
    );
  });

  test("creates alternative titles in the database", async () => {
    const course = await courseFixture({ organizationId });

    const courseContext: CourseContext = {
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: course.title,
      language: "en",
      organizationId,
      targetLanguage: null,
    };

    const altTitles = [`Alt Title A ${randomUUID()}`, `Alt Title B ${randomUUID()}`];

    await addAlternativeTitlesStep({
      alternativeTitles: altTitles,
      course: courseContext,
    });

    const dbAltTitles = await prisma.courseAlternativeTitle.findMany({
      where: { courseId: course.id },
    });

    expect(dbAltTitles).toHaveLength(2);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "addAlternativeTitles" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "addAlternativeTitles" }),
    );
  });
});
