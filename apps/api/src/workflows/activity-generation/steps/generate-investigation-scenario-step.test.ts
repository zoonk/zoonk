import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { fetchLessonActivities } from "@/workflows/activity-generation/steps/_utils/fetch-lesson-activities";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateInvestigationScenarioStep } from "./generate-investigation-scenario-step";

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

const { generateActivityInvestigationScenarioMock } = vi.hoisted(() => ({
  generateActivityInvestigationScenarioMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/activities/core/investigation-scenario", () => ({
  generateActivityInvestigationScenario: generateActivityInvestigationScenarioMock,
}));

const mockScenarioData = {
  explanations: [
    "Explanation A is the best one",
    "Explanation B is partial",
    "Explanation C is wrong",
  ],
  scenario: "A mysterious drop in website traffic occurred overnight.",
};

describe(generateInvestigationScenarioStep, () => {
  let organizationId: number;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    course = await courseFixture({ organizationId });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Gen Investigation Scenario Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns scenario data for an investigation activity", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["SEO", "Analytics"],
      organizationId,
      title: `Investigation Scenario ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    generateActivityInvestigationScenarioMock.mockResolvedValue({ data: mockScenarioData });

    const result = await generateInvestigationScenarioStep(activities);

    expect(result.activityId).toBe(activities.find((a) => a.kind === "investigation")?.id);
    expect(result.scenario).toEqual(mockScenarioData);
  });

  test("passes lesson context to AI task", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      concepts: ["Concept A", "Concept B"],
      organizationId,
      title: `Investigation Context ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "pt",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    generateActivityInvestigationScenarioMock.mockResolvedValue({ data: mockScenarioData });

    await generateInvestigationScenarioStep(activities);

    expect(generateActivityInvestigationScenarioMock).toHaveBeenCalledWith(
      expect.objectContaining({
        chapterTitle: chapter.title,
        concepts: ["Concept A", "Concept B"],
        courseTitle: course.title,
        language: "pt",
        lessonDescription: lesson.description,
        topic: lesson.title,
      }),
    );
  });

  test("returns null activityId when no investigation activity exists", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation None ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "explanation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Explanation ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    const result = await generateInvestigationScenarioStep(activities);

    expect(result).toEqual({ activityId: null, scenario: null });
    expect(generateActivityInvestigationScenarioMock).not.toHaveBeenCalled();
  });

  test("marks activity as failed when AI returns empty explanations", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Empty ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    generateActivityInvestigationScenarioMock.mockResolvedValue({
      data: { explanations: [], scenario: "A scenario" },
    });

    const result = await generateInvestigationScenarioStep(activities);

    expect(result).toEqual({ activityId: null, scenario: null });

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("failed");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: Number(dbActivity.id),
        status: "error",
        step: "generateInvestigationScenario",
      }),
    );
  });

  test("marks activity as failed when AI call throws", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation AI Error ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    generateActivityInvestigationScenarioMock.mockRejectedValue(new Error("AI failed"));

    const result = await generateInvestigationScenarioStep(activities);

    expect(result).toEqual({ activityId: null, scenario: null });

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("failed");

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: Number(dbActivity.id),
        status: "error",
        step: "generateInvestigationScenario",
      }),
    );
  });

  test("streams started and completed events on success", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      organizationId,
      title: `Investigation Stream ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "investigation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Investigation ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    const investigationActivity = activities.find((a) => a.kind === "investigation")!;

    generateActivityInvestigationScenarioMock.mockResolvedValue({ data: mockScenarioData });

    await generateInvestigationScenarioStep(activities);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: investigationActivity.id,
        status: "started",
        step: "generateInvestigationScenario",
      }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: investigationActivity.id,
        status: "completed",
        step: "generateInvestigationScenario",
      }),
    );
  });
});
