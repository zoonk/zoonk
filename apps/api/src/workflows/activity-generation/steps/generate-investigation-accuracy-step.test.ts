import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateInvestigationAccuracyStep } from "./generate-investigation-accuracy-step";

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

const { generateActivityInvestigationAccuracyMock } = vi.hoisted(() => ({
  generateActivityInvestigationAccuracyMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/activities/core/investigation-accuracy", () => ({
  generateActivityInvestigationAccuracy: generateActivityInvestigationAccuracyMock,
}));

const mockScenario = {
  explanations: ["Best explanation", "Partial explanation", "Wrong explanation"],
  scenario: "A mysterious drop in website traffic occurred overnight.",
};

const mockAccuracyData = {
  accuracies: [
    { accuracy: "best" as const, feedback: "This is the most complete explanation." },
    { accuracy: "partial" as const, feedback: "Has some truth but misses key insight." },
    { accuracy: "wrong" as const, feedback: "Plausible but incorrect." },
  ],
};

describe(generateInvestigationAccuracyStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Gen Investigation Accuracy Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns accuracy tiers for scenario explanations", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["SEO", "Analytics"],
      organizationId,
      title: `Investigation Accuracy ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    const activity = await prisma.activity.findUniqueOrThrow({
      include: {
        _count: { select: { steps: true } },
        lesson: {
          include: { chapter: { include: { course: { include: { organization: true } } } } },
        },
      },
      where: { id: dbActivity.id },
    });

    const activityWithNumericId = { ...activity, id: Number(activity.id) };

    generateActivityInvestigationAccuracyMock.mockResolvedValue({ data: mockAccuracyData });

    const result = await generateInvestigationAccuracyStep({
      activity: activityWithNumericId,
      activityId: Number(dbActivity.id),
      scenario: mockScenario,
    });

    expect(result).toEqual(mockAccuracyData);
  });

  test("passes scenario + topic + concepts + language to AI task", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Concept X", "Concept Y"],
      organizationId,
      title: `Investigation Accuracy Context ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "pt",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    const activity = await prisma.activity.findUniqueOrThrow({
      include: {
        _count: { select: { steps: true } },
        lesson: {
          include: { chapter: { include: { course: { include: { organization: true } } } } },
        },
      },
      where: { id: dbActivity.id },
    });

    const activityWithNumericId = { ...activity, id: Number(activity.id) };

    generateActivityInvestigationAccuracyMock.mockResolvedValue({ data: mockAccuracyData });

    await generateInvestigationAccuracyStep({
      activity: activityWithNumericId,
      activityId: Number(dbActivity.id),
      scenario: mockScenario,
    });

    expect(generateActivityInvestigationAccuracyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        concepts: ["Concept X", "Concept Y"],
        language: "pt",
        scenario: mockScenario,
        topic: lesson.title,
      }),
    );
  });

  test("returns null and marks as failed when AI call throws", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Accuracy Error ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    const activity = await prisma.activity.findUniqueOrThrow({
      include: {
        _count: { select: { steps: true } },
        lesson: {
          include: { chapter: { include: { course: { include: { organization: true } } } } },
        },
      },
      where: { id: dbActivity.id },
    });

    const activityWithNumericId = { ...activity, id: Number(activity.id) };

    generateActivityInvestigationAccuracyMock.mockRejectedValue(new Error("AI failed"));

    const result = await generateInvestigationAccuracyStep({
      activity: activityWithNumericId,
      activityId: Number(dbActivity.id),
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
        step: "generateInvestigationAccuracy",
      }),
    );
  });

  test("streams started and completed events on success", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Accuracy Stream ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    const activity = await prisma.activity.findUniqueOrThrow({
      include: {
        _count: { select: { steps: true } },
        lesson: {
          include: { chapter: { include: { course: { include: { organization: true } } } } },
        },
      },
      where: { id: dbActivity.id },
    });

    const activityWithNumericId = { ...activity, id: Number(activity.id) };

    generateActivityInvestigationAccuracyMock.mockResolvedValue({ data: mockAccuracyData });

    await generateInvestigationAccuracyStep({
      activity: activityWithNumericId,
      activityId: Number(dbActivity.id),
      scenario: mockScenario,
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: Number(dbActivity.id),
        status: "started",
        step: "generateInvestigationAccuracy",
      }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: Number(dbActivity.id),
        status: "completed",
        step: "generateInvestigationAccuracy",
      }),
    );
  });
});
