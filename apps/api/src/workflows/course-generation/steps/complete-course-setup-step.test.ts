import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { courseSuggestionFixture } from "@zoonk/testing/fixtures/course-suggestions";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { completeCourseSetupStep } from "./complete-course-setup-step";

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

describe(completeCourseSetupStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("streams error and throws when DB save fails", async () => {
    await expect(
      completeCourseSetupStep({
        courseId: 999_999_999,
        courseSuggestionId: 999_999_999,
      }),
    ).rejects.toThrow("DB save failed in completeCourseSetup");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "completeCourseSetup" }),
    );
  });

  test("marks both course and suggestion as completed", async () => {
    const [course, suggestion] = await Promise.all([
      courseFixture({
        generationStatus: "running",
        organizationId,
        title: `Complete Setup ${randomUUID()}`,
      }),
      courseSuggestionFixture({
        generationStatus: "running",
        title: `Complete Suggestion ${randomUUID()}`,
      }),
    ]);

    await completeCourseSetupStep({
      courseId: course.id,
      courseSuggestionId: suggestion.id,
    });

    const [updatedCourse, updatedSuggestion] = await Promise.all([
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      prisma.courseSuggestion.findUniqueOrThrow({ where: { id: suggestion.id } }),
    ]);

    expect(updatedCourse.generationStatus).toBe("completed");
    expect(updatedSuggestion.generationStatus).toBe("completed");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "completeCourseSetup" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "completeCourseSetup" }),
    );
  });
});
