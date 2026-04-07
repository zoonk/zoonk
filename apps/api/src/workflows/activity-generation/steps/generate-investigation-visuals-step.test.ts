import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateInvestigationVisualsStep } from "./generate-investigation-visuals-step";

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

const { generateInvestigationVisualMock } = vi.hoisted(() => ({
  generateInvestigationVisualMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/activities/core/investigation-visuals", () => ({
  generateInvestigationVisual: generateInvestigationVisualMock,
}));

const mockScenarioVisual = {
  data: { description: "A chart showing traffic decline", kind: "chart" as const },
};

const mockFindingVisual1 = {
  data: { description: "Server log table with error codes", kind: "table" as const },
};

const mockFindingVisual2 = {
  data: { description: "Timeline of CDN outage events", kind: "timeline" as const },
};

describe(generateInvestigationVisualsStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Gen Investigation Visuals Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns scenario visual and finding visuals", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Visuals ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    generateInvestigationVisualMock
      .mockResolvedValueOnce(mockScenarioVisual)
      .mockResolvedValueOnce(mockFindingVisual1)
      .mockResolvedValueOnce(mockFindingVisual2);

    const result = await generateInvestigationVisualsStep({
      activityId: Number(dbActivity.id),
      findings: ["Finding A text", "Finding B text"],
      language: "en",
      scenario: "The scenario text",
    });

    expect(result).toEqual({
      findingVisuals: [mockFindingVisual1.data, mockFindingVisual2.data],
      scenarioVisual: mockScenarioVisual.data,
    });
  });

  test("calls AI once for scenario (no finding) and once per finding", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Visuals Calls ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "pt",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    generateInvestigationVisualMock.mockResolvedValue(mockScenarioVisual);

    await generateInvestigationVisualsStep({
      activityId: Number(dbActivity.id),
      findings: ["Finding A", "Finding B"],
      language: "pt",
      scenario: "The scenario",
    });

    // 1 scenario call + 2 finding calls = 3
    expect(generateInvestigationVisualMock).toHaveBeenCalledTimes(3);

    // Scenario call (no finding param)
    expect(generateInvestigationVisualMock).toHaveBeenCalledWith({
      language: "pt",
      scenario: "The scenario",
    });

    // Finding calls include the finding param
    expect(generateInvestigationVisualMock).toHaveBeenCalledWith(
      expect.objectContaining({
        finding: "Finding A",
        language: "pt",
        scenario: "The scenario",
      }),
    );

    expect(generateInvestigationVisualMock).toHaveBeenCalledWith(
      expect.objectContaining({
        finding: "Finding B",
        language: "pt",
        scenario: "The scenario",
      }),
    );
  });

  test("returns null when any call fails", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Visuals Fail ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    generateInvestigationVisualMock
      .mockResolvedValueOnce(mockScenarioVisual)
      .mockRejectedValueOnce(new Error("AI failed"));

    const result = await generateInvestigationVisualsStep({
      activityId: Number(dbActivity.id),
      findings: ["Finding A"],
      language: "en",
      scenario: "The scenario",
    });

    expect(result).toBeNull();

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("failed");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: Number(dbActivity.id),
        status: "error",
        step: "generateInvestigationVisuals",
      }),
    );
  });

  test("streams started and completed events on success", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Visuals Stream ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    generateInvestigationVisualMock.mockResolvedValue(mockScenarioVisual);

    await generateInvestigationVisualsStep({
      activityId: Number(dbActivity.id),
      findings: ["Finding A"],
      language: "en",
      scenario: "The scenario",
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: Number(dbActivity.id),
        status: "started",
        step: "generateInvestigationVisuals",
      }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: Number(dbActivity.id),
        status: "completed",
        step: "generateInvestigationVisuals",
      }),
    );
  });
});
