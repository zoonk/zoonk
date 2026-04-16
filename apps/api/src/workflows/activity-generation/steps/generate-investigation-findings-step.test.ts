import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateInvestigationFindingsStep } from "./generate-investigation-findings-step";

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

const { generateActivityInvestigationFindingsMock } = vi.hoisted(() => ({
  generateActivityInvestigationFindingsMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/activities/core/investigation-findings", () => ({
  generateActivityInvestigationFindings: generateActivityInvestigationFindingsMock,
}));

const mockScenario = {
  explanations: ["Best explanation", "Partial explanation", "Wrong explanation"],
  scenario: "A mysterious drop in website traffic occurred overnight.",
};

const mockAccuracy = {
  accuracies: [
    { accuracy: "best" as const, feedback: "Correct." },
    { accuracy: "partial" as const, feedback: "Partially right." },
    { accuracy: "wrong" as const, feedback: "Incorrect." },
  ],
};

const mockActions = {
  actions: [
    { label: "Check server logs", quality: "critical" as const },
    { label: "Review DNS records", quality: "useful" as const },
  ],
};

const mockFindingsData = {
  findings: [
    "Server logs show a spike in 500 errors around 2 AM, but the deployment log shows no changes.",
    "DNS records are unchanged, but a third-party CDN outage was reported at 1:45 AM.",
  ],
};

describe(generateInvestigationFindingsStep, () => {
  let organizationId: string;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Gen Investigation Findings Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns findings array", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Findings ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    generateActivityInvestigationFindingsMock.mockResolvedValue({ data: mockFindingsData });

    const result = await generateInvestigationFindingsStep({
      accuracy: mockAccuracy,
      actions: mockActions,
      activityId: dbActivity.id,
      language: "en",
      scenario: mockScenario,
    });

    expect(result).toEqual(mockFindingsData);
  });

  test("passes scenario + accuracy + actions + language to AI task", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Findings Context ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "pt",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    generateActivityInvestigationFindingsMock.mockResolvedValue({ data: mockFindingsData });

    await generateInvestigationFindingsStep({
      accuracy: mockAccuracy,
      actions: mockActions,
      activityId: dbActivity.id,
      language: "pt",
      scenario: mockScenario,
    });

    expect(generateActivityInvestigationFindingsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accuracy: mockAccuracy,
        actions: mockActions,
        language: "pt",
        scenario: mockScenario,
      }),
    );
  });

  test("returns null and marks as failed when AI returns empty findings", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Findings Empty ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    generateActivityInvestigationFindingsMock.mockResolvedValue({
      data: { findings: [] },
    });

    const result = await generateInvestigationFindingsStep({
      accuracy: mockAccuracy,
      actions: mockActions,
      activityId: dbActivity.id,
      language: "en",
      scenario: mockScenario,
    });

    expect(result).toBeNull();

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("failed");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: dbActivity.id,
        status: "error",
        step: "generateInvestigationFindings",
      }),
    );
  });

  test("returns null and marks as failed when AI call throws", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Findings Error ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    generateActivityInvestigationFindingsMock.mockRejectedValue(new Error("AI failed"));

    const result = await generateInvestigationFindingsStep({
      accuracy: mockAccuracy,
      actions: mockActions,
      activityId: dbActivity.id,
      language: "en",
      scenario: mockScenario,
    });

    expect(result).toBeNull();

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("failed");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: dbActivity.id,
        status: "error",
        step: "generateInvestigationFindings",
      }),
    );
  });

  test("streams started and completed events on success", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Findings Stream ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    generateActivityInvestigationFindingsMock.mockResolvedValue({ data: mockFindingsData });

    await generateInvestigationFindingsStep({
      accuracy: mockAccuracy,
      actions: mockActions,
      activityId: dbActivity.id,
      language: "en",
      scenario: mockScenario,
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: dbActivity.id,
        status: "started",
        step: "generateInvestigationFindings",
      }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: dbActivity.id,
        status: "completed",
        step: "generateInvestigationFindings",
      }),
    );
  });
});
