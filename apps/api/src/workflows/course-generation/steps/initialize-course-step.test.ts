import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { courseSuggestionFixture } from "@zoonk/testing/fixtures/course-suggestions";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { initializeCourseStep } from "./initialize-course-step";

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

describe(initializeCourseStep, () => {
  beforeAll(async () => {
    await aiOrganizationFixture();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("throws without streaming error when suggestion update fails", async () => {
    const suggestion = await courseSuggestionFixture({
      title: `Missing Suggestion ${randomUUID()}`,
    });

    const fakeSuggestion = {
      ...suggestion,
      id: randomUUID(),
      slug: `nonexistent-${randomUUID()}`,
      title: "Nonexistent",
    };

    await expect(
      initializeCourseStep({ suggestion: fakeSuggestion, workflowRunId: "run-id" }),
    ).rejects.toThrow();

    const events = getStreamedEvents(writeMock);

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "initializeCourse" }),
    );
  });

  test("creates a course and marks suggestion as running", async () => {
    const suggestion = await courseSuggestionFixture({
      title: `Init Course ${randomUUID()}`,
    });

    const workflowRunId = `run-${randomUUID()}`;

    const result = await initializeCourseStep({ suggestion, workflowRunId });

    expect(result.courseTitle).toBe(suggestion.title);
    expect(result.language).toBe(suggestion.language);
    expect(result.courseId).toEqual(expect.any(String));

    const [updatedSuggestion, createdCourse] = await Promise.all([
      prisma.courseSuggestion.findUniqueOrThrow({ where: { id: suggestion.id } }),
      prisma.course.findUniqueOrThrow({ where: { id: result.courseId } }),
    ]);

    expect(updatedSuggestion.generationStatus).toBe("running");
    expect(updatedSuggestion.generationRunId).toBe(workflowRunId);
    expect(createdCourse.generationStatus).toBe("running");
    expect(createdCourse.isPublished).toBe(true);
    expect(createdCourse.title).toBe(suggestion.title);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "initializeCourse" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "initializeCourse" }),
    );
  });

  test("sets targetLanguage on course when suggestion has one", async () => {
    const suggestion = await courseSuggestionFixture({
      targetLanguage: "es",
      title: `Language Course ${randomUUID()}`,
    });

    const result = await initializeCourseStep({
      suggestion,
      workflowRunId: `run-${randomUUID()}`,
    });

    expect(result.targetLanguage).toBe("es");

    const course = await prisma.course.findUniqueOrThrow({ where: { id: result.courseId } });

    expect(course.targetLanguage).toBe("es");
  });
});
