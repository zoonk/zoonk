import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { courseSuggestionFixture } from "@zoonk/testing/fixtures/course-suggestions";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { setCourseAsRunningStep } from "./set-course-as-running-step";

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

describe(setCourseAsRunningStep, () => {
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
      setCourseAsRunningStep({
        courseId: 999_999_999,
        courseSuggestionId: 999_999_999,
        workflowRunId: "run-id",
      }),
    ).rejects.toThrow("DB save failed in setCourseAsRunning");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "setCourseAsRunning" }),
    );
  });

  test("marks both course and suggestion as running", async () => {
    const [course, suggestion] = await Promise.all([
      courseFixture({
        organizationId,
        title: `Set Running ${randomUUID()}`,
      }),
      courseSuggestionFixture({
        title: `Running Suggestion ${randomUUID()}`,
      }),
    ]);

    const workflowRunId = `run-${randomUUID()}`;

    await setCourseAsRunningStep({
      courseId: course.id,
      courseSuggestionId: suggestion.id,
      workflowRunId,
    });

    const [updatedCourse, updatedSuggestion] = await Promise.all([
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      prisma.courseSuggestion.findUniqueOrThrow({ where: { id: suggestion.id } }),
    ]);

    expect(updatedCourse.generationStatus).toBe("running");
    expect(updatedSuggestion.generationStatus).toBe("running");
    expect(updatedSuggestion.generationRunId).toBe(workflowRunId);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "setCourseAsRunning" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "setCourseAsRunning" }),
    );
  });
});
