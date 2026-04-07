import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateInvestigationVisualContentStep } from "./generate-investigation-visual-content-step";

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

const { dispatchVisualContentMock } = vi.hoisted(() => ({
  dispatchVisualContentMock: vi.fn(),
}));

vi.mock("./_utils/dispatch-visual-content", () => ({
  dispatchVisualContent: dispatchVisualContentMock,
}));

const mockScenarioVisual = {
  description: "A chart showing traffic decline",
  kind: "chart" as const,
};

const mockFindingVisual1 = {
  description: "Server log table with error codes",
  kind: "table" as const,
};

const mockFindingVisual2 = {
  description: "Timeline of CDN outage events",
  kind: "timeline" as const,
};

describe(generateInvestigationVisualContentStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Gen Investigation Visual Content Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("dispatches visual descriptions through dispatchVisualContent", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Visual Content ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    const dispatchedScenario = {
      chartType: "line",
      data: [{ name: "Mon", value: 100 }],
      kind: "chart",
      title: "Traffic",
    };
    const dispatchedFinding1 = { columns: ["Time", "Code"], kind: "table", rows: [["2AM", "500"]] };
    const dispatchedFinding2 = {
      events: [{ date: "2025-01-01", description: "CDN down", title: "Outage" }],
      kind: "timeline",
    };

    dispatchVisualContentMock.mockResolvedValue([
      dispatchedScenario,
      dispatchedFinding1,
      dispatchedFinding2,
    ]);

    const result = await generateInvestigationVisualContentStep({
      activityId: Number(dbActivity.id),
      findingVisuals: [mockFindingVisual1, mockFindingVisual2],
      language: "en",
      orgSlug: "test-org",
      scenarioVisual: mockScenarioVisual,
    });

    expect(dispatchVisualContentMock).toHaveBeenCalledWith({
      descriptions: [mockScenarioVisual, mockFindingVisual1, mockFindingVisual2],
      language: "en",
      orgSlug: "test-org",
    });

    expect(result).not.toBeNull();
  });

  test("returns dispatched visuals in correct order (scenario first, then findings)", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Visual Content Order ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    const dispatchedScenario = {
      chartType: "line",
      data: [{ name: "Mon", value: 100 }],
      kind: "chart",
      title: "Traffic",
    };
    const dispatchedFinding1 = { columns: ["Time", "Code"], kind: "table", rows: [["2AM", "500"]] };
    const dispatchedFinding2 = {
      events: [{ date: "2025-01-01", description: "CDN down", title: "Outage" }],
      kind: "timeline",
    };

    dispatchVisualContentMock.mockResolvedValue([
      dispatchedScenario,
      dispatchedFinding1,
      dispatchedFinding2,
    ]);

    const result = await generateInvestigationVisualContentStep({
      activityId: Number(dbActivity.id),
      findingVisuals: [mockFindingVisual1, mockFindingVisual2],
      language: "en",
      scenarioVisual: mockScenarioVisual,
    });

    expect(result!.scenarioVisual).toEqual(dispatchedScenario);
    expect(result!.findingVisuals).toEqual([dispatchedFinding1, dispatchedFinding2]);
  });

  test("returns null when dispatch throws", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Visual Content Error ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    dispatchVisualContentMock.mockRejectedValue(new Error("Dispatch failed"));

    const result = await generateInvestigationVisualContentStep({
      activityId: Number(dbActivity.id),
      findingVisuals: [mockFindingVisual1],
      language: "en",
      scenarioVisual: mockScenarioVisual,
    });

    expect(result).toBeNull();

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("failed");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: Number(dbActivity.id),
        status: "error",
        step: "generateInvestigationVisualContent",
      }),
    );
  });

  test("streams started and completed events on success", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Visual Content Stream ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    dispatchVisualContentMock.mockResolvedValue([
      { chartType: "bar", data: [], kind: "chart", title: "Scenario" },
      { columns: ["A"], kind: "table", rows: [] },
    ]);

    await generateInvestigationVisualContentStep({
      activityId: Number(dbActivity.id),
      findingVisuals: [mockFindingVisual1],
      language: "en",
      scenarioVisual: mockScenarioVisual,
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: Number(dbActivity.id),
        status: "started",
        step: "generateInvestigationVisualContent",
      }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: Number(dbActivity.id),
        status: "completed",
        step: "generateInvestigationVisualContent",
      }),
    );
  });
});
