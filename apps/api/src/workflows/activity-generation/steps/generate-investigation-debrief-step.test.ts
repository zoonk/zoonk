import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateInvestigationDebriefStep } from "./generate-investigation-debrief-step";

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

const { generateActivityInvestigationDebriefMock } = vi.hoisted(() => ({
  generateActivityInvestigationDebriefMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/activities/core/investigation-debrief", () => ({
  generateActivityInvestigationDebrief: generateActivityInvestigationDebriefMock,
}));

const mockScenario = {
  explanations: ["Best explanation", "Partial explanation", "Wrong explanation"],
  scenario: "A mysterious drop in website traffic occurred overnight.",
};

const mockAccuracy = {
  accuracies: ["best", "partial", "wrong"] as ("best" | "partial" | "wrong")[],
};

const mockActions = {
  actions: [
    { label: "Check server logs", quality: "critical" as const },
    { label: "Review DNS records", quality: "useful" as const },
  ],
};

const mockFindings = {
  findings: [
    "Server logs show 500 errors around 2 AM.",
    "DNS records are unchanged but CDN had an outage.",
  ],
};

const mockDebriefData = {
  fullExplanation:
    "The traffic drop was caused by a CDN outage that triggered cascading 500 errors on the origin server.",
};

describe(generateInvestigationDebriefStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Gen Investigation Debrief Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns fullExplanation string", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Debrief ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    generateActivityInvestigationDebriefMock.mockResolvedValue({ data: mockDebriefData });

    const result = await generateInvestigationDebriefStep({
      accuracy: mockAccuracy,
      actions: mockActions,
      activityId: Number(dbActivity.id),
      findings: mockFindings,
      language: "en",
      scenario: mockScenario,
    });

    expect(result).toEqual(mockDebriefData);
  });

  test("passes all inputs to AI task", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Debrief Context ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "pt",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    generateActivityInvestigationDebriefMock.mockResolvedValue({ data: mockDebriefData });

    await generateInvestigationDebriefStep({
      accuracy: mockAccuracy,
      actions: mockActions,
      activityId: Number(dbActivity.id),
      findings: mockFindings,
      language: "pt",
      scenario: mockScenario,
    });

    expect(generateActivityInvestigationDebriefMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accuracy: mockAccuracy,
        actions: mockActions,
        findings: mockFindings,
        language: "pt",
        scenario: mockScenario,
      }),
    );
  });

  test("returns null and marks as failed when AI call throws", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Debrief Error ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    generateActivityInvestigationDebriefMock.mockRejectedValue(new Error("AI failed"));

    const result = await generateInvestigationDebriefStep({
      accuracy: mockAccuracy,
      actions: mockActions,
      activityId: Number(dbActivity.id),
      findings: mockFindings,
      language: "en",
      scenario: mockScenario,
    });

    expect(result).toBeNull();

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("failed");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: Number(dbActivity.id),
        status: "error",
        step: "generateInvestigationDebrief",
      }),
    );
  });

  test("streams started and completed events on success", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Debrief Stream ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    generateActivityInvestigationDebriefMock.mockResolvedValue({ data: mockDebriefData });

    await generateInvestigationDebriefStep({
      accuracy: mockAccuracy,
      actions: mockActions,
      activityId: Number(dbActivity.id),
      findings: mockFindings,
      language: "en",
      scenario: mockScenario,
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: Number(dbActivity.id),
        status: "started",
        step: "generateInvestigationDebrief",
      }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: Number(dbActivity.id),
        status: "completed",
        step: "generateInvestigationDebrief",
      }),
    );
  });
});
