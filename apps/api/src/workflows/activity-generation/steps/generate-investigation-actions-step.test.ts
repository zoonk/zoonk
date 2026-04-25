import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateInvestigationActionsStep } from "./generate-investigation-actions-step";

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

const { generateActivityInvestigationActionsMock } = vi.hoisted(() => ({
  generateActivityInvestigationActionsMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/activities/core/investigation-actions", () => ({
  generateActivityInvestigationActions: generateActivityInvestigationActionsMock,
}));

const mockScenario = {
  explanations: ["Best explanation", "Partial explanation", "Wrong explanation"],
  scenario: "A mysterious drop in website traffic occurred overnight.",
  title: "Who froze the payment queue?",
};

const mockAccuracy = {
  accuracies: [
    { accuracy: "best" as const, feedback: "Correct." },
    { accuracy: "partial" as const, feedback: "Partially right." },
    { accuracy: "wrong" as const, feedback: "Incorrect." },
  ],
};

const mockActionsData = {
  actions: [
    { label: "Check server logs", quality: "critical" as const },
    { label: "Review DNS records", quality: "useful" as const },
    { label: "Ask a colleague", quality: "weak" as const },
  ],
};

describe(generateInvestigationActionsStep, () => {
  let organizationId: string;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Gen Investigation Actions Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns actions with labels and quality tiers", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Actions ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    generateActivityInvestigationActionsMock.mockResolvedValue({ data: mockActionsData });

    const result = await generateInvestigationActionsStep({
      accuracy: mockAccuracy,
      activityId: dbActivity.id,
      language: "en",
      scenario: mockScenario,
    });

    expect(result).toEqual(mockActionsData);
  });

  test("passes scenario + accuracy + language to AI task", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Actions Context ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "pt",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    generateActivityInvestigationActionsMock.mockResolvedValue({ data: mockActionsData });

    await generateInvestigationActionsStep({
      accuracy: mockAccuracy,
      activityId: dbActivity.id,
      language: "pt",
      scenario: mockScenario,
    });

    expect(generateActivityInvestigationActionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accuracy: mockAccuracy,
        language: "pt",
        scenario: mockScenario,
      }),
    );
  });

  test("throws when AI returns empty actions", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Actions Empty ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    generateActivityInvestigationActionsMock.mockResolvedValue({
      data: { actions: [] },
    });

    await expect(
      generateInvestigationActionsStep({
        accuracy: mockAccuracy,
        activityId: dbActivity.id,
        language: "en",
        scenario: mockScenario,
      }),
    ).rejects.toThrow("contentValidationFailed");

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("pending");

    const events = getStreamedEvents(writeMock);

    expect(events).not.toContainEqual(
      expect.objectContaining({
        entityId: dbActivity.id,
        status: "error",
        step: "generateInvestigationActions",
      }),
    );
  });

  test("throws AI errors without streaming an error status", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Actions Error ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    generateActivityInvestigationActionsMock.mockRejectedValue(new Error("AI failed"));

    await expect(
      generateInvestigationActionsStep({
        accuracy: mockAccuracy,
        activityId: dbActivity.id,
        language: "en",
        scenario: mockScenario,
      }),
    ).rejects.toThrow("AI failed");

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("pending");

    const events = getStreamedEvents(writeMock);

    expect(events).not.toContainEqual(
      expect.objectContaining({
        entityId: dbActivity.id,
        status: "error",
        step: "generateInvestigationActions",
      }),
    );
  });

  test("streams started and completed events on success", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Actions Stream ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    generateActivityInvestigationActionsMock.mockResolvedValue({ data: mockActionsData });

    await generateInvestigationActionsStep({
      accuracy: mockAccuracy,
      activityId: dbActivity.id,
      language: "en",
      scenario: mockScenario,
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: dbActivity.id,
        status: "started",
        step: "generateInvestigationActions",
      }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: dbActivity.id,
        status: "completed",
        step: "generateInvestigationActions",
      }),
    );
  });
});
